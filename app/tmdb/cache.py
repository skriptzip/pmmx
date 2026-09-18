from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TmdbProviderCache

PROVIDER_TTL_DAYS = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_cached_providers(
    db: AsyncSession, tmdb_id: int, media_type: str
) -> dict[str, list[dict]] | None:
    row = await db.get(TmdbProviderCache, (tmdb_id, media_type))
    if row is None:
        return None
    if row.cached_at < _now() - timedelta(days=PROVIDER_TTL_DAYS):
        return None
    return json.loads(row.data_json)


async def set_cached_providers(
    db: AsyncSession, tmdb_id: int, media_type: str, data: dict[str, list[dict]]
) -> None:
    row = await db.get(TmdbProviderCache, (tmdb_id, media_type))
    if row:
        row.data_json = json.dumps(data)
        row.cached_at = _now()
    else:
        db.add(TmdbProviderCache(
            tmdb_id=tmdb_id,
            media_type=media_type,
            data_json=json.dumps(data),
            cached_at=_now(),
        ))
