from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LibraryMovie, LibraryShow, MissingEpisode, MissingMovie

logger = logging.getLogger(__name__)


def _has_services(raw: str | None) -> bool:
    return bool(raw) and raw != "[]"


def _aired(raw: str | None) -> bool:
    try:
        return bool(raw) and date.fromisoformat(raw) <= date.today()
    except ValueError:
        return False


def _open_status(streaming_services: str | None) -> str:
    return "streamable" if _has_services(streaming_services) else "missing"


async def apply_plex_state(
    db: AsyncSession, user_id: int, movies: list[dict], shows: list[dict]
) -> dict[str, int]:
    """Bring library and missing tables in line with what Plex has now.

    Works only on data from earlier scans (no TMDb requests): items that arrived in
    Plex are marked present, items that left Plex become missing again, and
    "upcoming" turns into "missing" once the release/air date has passed.
    What needs TMDb (posters, collections and episode lists of titles that were
    never scanned, newly released episodes) is left to the next full scan.
    """
    stats = {"movies_new": 0, "movies_gone": 0, "episodes_found": 0, "shows_gone": 0, "shows_unknown": 0}
    await _apply_movies(db, user_id, movies, stats)
    await _apply_shows(db, user_id, shows, stats)
    await db.commit()
    return stats


async def _apply_movies(db: AsyncSession, user_id: int, movies: list[dict], stats: dict[str, int]) -> None:
    plex = {m["tmdb_id"]: m for m in movies if m["tmdb_id"]}

    lib = {
        r.tmdb_id: r
        for r in (await db.execute(select(LibraryMovie).where(LibraryMovie.user_id == user_id))).scalars()
    }
    open_rows = {
        r.tmdb_id: r
        for r in (await db.execute(select(MissingMovie).where(MissingMovie.user_id == user_id))).scalars()
    }

    for tmdb_id, row in lib.items():
        if tmdb_id in plex:
            row.status = "present"
            row.plex_key = plex[tmdb_id]["plex_key"]
        elif row.plex_key is not None:
            # was in Plex, isn't anymore
            stats["movies_gone"] += 1
            if row.collection_id is None:
                await db.delete(row)  # without a collection nothing says it should exist
                continue
            row.plex_key = None
            row.status = _open_status(row.streaming_services)
            if tmdb_id not in open_rows:
                db.add(MissingMovie(
                    user_id=user_id,
                    tmdb_id=tmdb_id,
                    title=row.title,
                    year=row.year,
                    collection_id=row.collection_id,
                    collection_name=row.collection_name or "",
                    release_date=row.release_date,
                    status=row.status,
                    streaming_services=row.streaming_services,
                    poster_path=row.poster_path,
                ))
        elif row.status == "upcoming" and _aired(row.release_date):
            row.status = _open_status(row.streaming_services)

    for tmdb_id, row in open_rows.items():
        if tmdb_id in plex:
            await db.delete(row)
        elif row.status == "upcoming" and _aired(row.release_date):
            row.status = _open_status(row.streaming_services)

    for tmdb_id, m in plex.items():
        if tmdb_id in lib:
            continue
        stats["movies_new"] += 1
        db.add(LibraryMovie(
            user_id=user_id,
            tmdb_id=tmdb_id,
            plex_key=m["plex_key"],
            title=m["title"],
            year=m.get("year"),
            status="present",
        ))


async def _apply_shows(db: AsyncSession, user_id: int, shows: list[dict], stats: dict[str, int]) -> None:
    plex = {s["plex_key"]: s for s in shows}

    lib_shows = (await db.execute(select(LibraryShow).where(LibraryShow.user_id == user_id))).scalars().all()
    episodes_by_show: dict[int, list[MissingEpisode]] = {}
    for ep in (await db.execute(select(MissingEpisode).where(MissingEpisode.user_id == user_id))).scalars():
        episodes_by_show.setdefault(ep.show_tmdb_id, []).append(ep)

    known = set()
    for row in lib_shows:
        if row.plex_key is None:
            continue
        known.add(row.plex_key)
        show = plex.get(row.plex_key)

        if show is None:
            stats["shows_gone"] += 1
            await db.execute(delete(MissingEpisode).where(
                MissingEpisode.user_id == user_id, MissingEpisode.show_tmdb_id == row.tmdb_id
            ))
            await db.delete(row)
            continue

        present = {
            (s["season_number"], ep["episode_number"])
            for s in show["seasons"]
            for ep in s["episodes"]
        }
        remaining = 0
        for ep in episodes_by_show.get(row.tmdb_id, []):
            if (ep.season_number, ep.episode_number) in present:
                stats["episodes_found"] += 1
                await db.delete(ep)
                continue
            remaining += 1
            if ep.status == "upcoming" and _aired(ep.air_date):
                ep.status = _open_status(ep.streaming_services)

        row.episodes_present = len(present)
        row.missing_count = remaining
        row.status = "complete" if remaining == 0 else "incomplete"
        row.last_updated = datetime.now(timezone.utc)

    stats["shows_unknown"] = len([k for k in plex if k not in known])
