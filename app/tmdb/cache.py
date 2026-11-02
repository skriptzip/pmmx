from __future__ import annotations

import json
import threading
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TmdbProviderCache, TmdbResponseCache

PROVIDER_TTL_DAYS = 7
RESPONSE_PURGE_DAYS = 90

Ttl = timedelta | Callable[[dict], timedelta]


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


class ResponseCache:
    """In-memory view of tmdb_response_cache.

    The TMDb client is synchronous and runs in worker threads, so the async DB
    access happens before (load) and after (save) a scan, not per request.
    """

    def __init__(self, entries: dict[str, tuple[dict, datetime]] | None = None) -> None:
        self._entries = entries or {}
        self._dirty: set[str] = set()
        self._lock = threading.Lock()

    def get(self, key: str, ttl: Ttl) -> dict | None:
        with self._lock:
            entry = self._entries.get(key)
        if entry is None:
            return None
        data, cached_at = entry
        max_age = ttl(data) if callable(ttl) else ttl
        if cached_at < _now() - max_age:
            return None
        return data

    def put(self, key: str, data: dict) -> None:
        with self._lock:
            self._entries[key] = (data, _now())
            self._dirty.add(key)

    def invalidate_where(self, match: Callable[[str], bool]) -> None:
        with self._lock:
            for key in [k for k in self._entries if match(k)]:
                del self._entries[key]

    def pop_dirty(self) -> dict[str, tuple[dict, datetime]]:
        with self._lock:
            dirty = {k: self._entries[k] for k in self._dirty if k in self._entries}
            self._dirty.clear()
        return dirty


async def load_response_cache(db: AsyncSession) -> ResponseCache:
    await db.execute(
        delete(TmdbResponseCache).where(
            TmdbResponseCache.cached_at < _now() - timedelta(days=RESPONSE_PURGE_DAYS)
        )
    )
    rows = (await db.execute(select(TmdbResponseCache))).scalars().all()
    await db.commit()
    return ResponseCache({r.key: (json.loads(r.data_json), r.cached_at) for r in rows})


async def save_response_cache(db: AsyncSession, cache: ResponseCache) -> None:
    for key, (data, cached_at) in cache.pop_dirty().items():
        row = await db.get(TmdbResponseCache, key)
        if row:
            row.data_json = json.dumps(data)
            row.cached_at = cached_at
        else:
            db.add(TmdbResponseCache(key=key, data_json=json.dumps(data), cached_at=cached_at))
    await db.commit()
