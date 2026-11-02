from __future__ import annotations

import asyncio
import logging
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.api.library import show_items
from app.config import get_settings
from app.db.database import get_session_factory
from app.db.models import ScanRun, User
from app.scan.orchestrator import ScanOrchestrator

logger = logging.getLogger(__name__)
router = APIRouter()


class ScanTriggerBody(BaseModel):
    scan_type: Literal["full", "availability", "plex"] = "full"


async def _run_scan(user_id: int, scan_type: str) -> None:
    settings = get_settings()
    async with get_session_factory()() as db:
        user = await db.get(User, user_id)
        if not user:
            return
        orc = ScanOrchestrator(user, settings, db)
        if scan_type == "availability":
            await orc.run_availability_check()
        elif scan_type == "plex":
            await orc.run_plex_rescan()
        else:
            await orc.run_full_scan()


@router.post("/trigger")
async def trigger_scan(
    body: ScanTriggerBody,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    background_tasks.add_task(_run_scan, user.id, body.scan_type)
    return {"message": "Scan started", "scan_type": body.scan_type}


@router.post("/show/{tmdb_id}")
async def refresh_show(
    tmdb_id: int,
    refresh_tmdb: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-check one show against Plex without running a full scan.

    refresh_tmdb=true also drops the cached TMDb data of that show.
    """
    from app.scan.progress import get_progress
    if get_progress(user.id):
        raise HTTPException(status_code=409, detail="A scan is already running")

    try:
        lib = await ScanOrchestrator(user, get_settings(), db).refresh_show(tmdb_id, refresh_tmdb)
    except LookupError:
        raise HTTPException(status_code=404, detail="Show not in library")
    except Exception as exc:
        logger.exception("Refresh of show %d failed for user %s", tmdb_id, user.username)
        raise HTTPException(status_code=502, detail=f"Refresh failed: {exc}")
    return (await show_items(db, user.id, [lib]))[0]


@router.get("/progress")
async def scan_progress(user: User = Depends(get_current_user)):
    from app.scan.progress import get_progress
    p = get_progress(user.id)
    if not p:
        return None
    return {
        "stage": p.stage,
        "movies_total": p.movies_total,
        "movies_checked": p.movies_checked,
        "shows_total": p.shows_total,
        "shows_checked": p.shows_checked,
        "current_item": p.current_item,
        "started_at": p.started_at.isoformat(),
    }


@router.get("/status")
async def scan_status(
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScanRun)
        .where(ScanRun.user_id == user.id)
        .order_by(ScanRun.started_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": r.id,
            "scan_type": r.scan_type,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "status": r.status,
            "error": r.error,
        }
        for r in result.scalars().all()
    ]
