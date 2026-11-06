from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.auth.jwt import create_access_token
from app.auth.plex_oauth import create_pin, get_user_info, list_servers, poll_pin
from app.config import get_settings
from app.db.models import User

router = APIRouter()


class ServerSelect(BaseModel):
    server_name: str
    server_client_id: str


@router.post("/plex/pin")
async def start_plex_login():
    pin_id, code, client_id, auth_url = await asyncio.to_thread(create_pin)
    return {"pin_id": pin_id, "code": code, "client_id": client_id, "auth_url": auth_url}


@router.get("/plex/poll/{pin_id}")
async def poll_plex_login(
    pin_id: int,
    code: str = Query(..., min_length=1, max_length=64),
    client_id: str = Query(..., min_length=1, max_length=64),
    db: AsyncSession = Depends(get_db),
):
    token = await asyncio.to_thread(poll_pin, pin_id, code, client_id)
    if token is False:
        return {"status": "expired"}
    if not token:
        return {"status": "pending"}

    user_info = await asyncio.to_thread(get_user_info, token)
    settings = get_settings()
    allowed = {u.lower() for u in settings.auth.allowed_users}
    if allowed and not {user_info["username"].lower(), (user_info["email"] or "").lower()} & allowed:
        raise HTTPException(status_code=403, detail="Dieser Plex-Nutzer ist nicht freigeschaltet")

    servers = await asyncio.to_thread(list_servers, token)

    # Upsert user
    result = await db.execute(select(User).where(User.plex_uuid == user_info["plex_uuid"]))
    user = result.scalar_one_or_none()
    if user:
        user.plex_token = token
        user.username = user_info["username"]
        user.email = user_info["email"]
        user.thumb = user_info["thumb"]
    else:
        user = User(
            plex_uuid=user_info["plex_uuid"],
            username=user_info["username"],
            email=user_info["email"],
            thumb=user_info["thumb"],
            plex_token=token,
        )
        db.add(user)
    await db.commit()
    await db.refresh(user)

    jwt = create_access_token(user.id, settings.secret_key)
    return {"status": "authorized", "jwt": jwt, "servers": servers}


@router.patch("/plex/server")
async def select_server(
    body: ServerSelect,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.server_name = body.server_name
    user.server_client_id = body.server_client_id
    await db.commit()
    return {"message": "Server selected"}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "thumb": user.thumb,
        "server_name": user.server_name,
    }
