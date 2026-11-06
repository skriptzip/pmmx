from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.config import get_settings
from app.db.models import User
from app.notifications.urlcheck import validate_discord_url, validate_url

router = APIRouter()

_NOTIFICATION_KEYS = {
    "provider", "ntfy_url", "ntfy_topic", "discord_webhook_url", "pushover_token", "pushover_user",
}
_PROVIDERS = {"", "ntfy", "discord", "pushover"}

_DEFAULT_AUDIO = ["de", "en"]
_DEFAULT_SUBTITLES = ["de"]


class SettingsPayload(BaseModel):
    audio_langs: list[str] | None = None
    subtitle_langs: list[str] | None = None
    owned_streaming_services: list[str] | None = None
    streaming_region: str | None = None
    notification_config: dict | None = None


@router.get("")
async def get_settings_endpoint(user: User = Depends(get_current_user)):
    cfg = get_settings()
    nc = json.loads(user.notification_config) if user.notification_config else {}
    return {
        "audio_langs": json.loads(user.preferred_audio_langs) if user.preferred_audio_langs else _DEFAULT_AUDIO,
        "subtitle_langs": json.loads(user.preferred_subtitle_langs) if user.preferred_subtitle_langs else _DEFAULT_SUBTITLES,
        "owned_streaming_services": json.loads(user.owned_streaming_services) if user.owned_streaming_services else [],
        "streaming_region": user.streaming_region or "DE",
        "notification_provider": nc.get("provider", ""),
        "ntfy_url": nc.get("ntfy_url", "https://ntfy.sh"),
        "ntfy_topic": nc.get("ntfy_topic", "pmmx"),
        "discord_webhook_url": nc.get("discord_webhook_url", ""),
        "pushover_token": nc.get("pushover_token", ""),
        "pushover_user": nc.get("pushover_user", ""),
    }


@router.put("")
async def update_settings(
    body: SettingsPayload,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.audio_langs is not None:
        user.preferred_audio_langs = json.dumps(body.audio_langs)
    if body.subtitle_langs is not None:
        user.preferred_subtitle_langs = json.dumps(body.subtitle_langs)
    if body.owned_streaming_services is not None:
        user.owned_streaming_services = json.dumps(body.owned_streaming_services)
    if body.streaming_region is not None:
        user.streaming_region = body.streaming_region
    if body.notification_config is not None:
        existing = json.loads(user.notification_config) if user.notification_config else {}
        incoming = {
            k: v for k, v in body.notification_config.items()
            if k in _NOTIFICATION_KEYS and isinstance(v, str) and len(v) <= 500
        }
        try:
            if incoming.get("provider", "") not in _PROVIDERS:
                raise ValueError("Unknown notification provider")
            if incoming.get("ntfy_url"):
                await asyncio.to_thread(
                    validate_url, incoming["ntfy_url"], get_settings().notifications.internal_hosts
                )
            if incoming.get("discord_webhook_url"):
                validate_discord_url(incoming["discord_webhook_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        existing.update(incoming)
        user.notification_config = json.dumps(existing)
    await db.commit()
    return {"message": "Settings updated"}
