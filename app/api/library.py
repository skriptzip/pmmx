from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import LibraryMovie, LibraryShow, MissingEpisode, User

router = APIRouter()


@router.get("/movies")
async def library_movies(
    status: str = "all",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(LibraryMovie).where(LibraryMovie.user_id == user.id)
    if status != "all":
        q = q.where(LibraryMovie.status == status)
    q = q.order_by(LibraryMovie.collection_name, LibraryMovie.year, LibraryMovie.title)
    result = await db.execute(q)
    return [
        {
            "id": m.id,
            "tmdb_id": m.tmdb_id,
            "plex_key": m.plex_key,
            "title": m.title,
            "year": m.year,
            "poster_path": m.poster_path,
            "collection_id": m.collection_id,
            "collection_name": m.collection_name,
            "release_date": m.release_date,
            "status": m.status,
            "streaming_services": json.loads(m.streaming_services or "[]"),
        }
        for m in result.scalars().all()
    ]


@router.get("/shows")
async def library_shows(
    status: str = "all",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(LibraryShow).where(LibraryShow.user_id == user.id)
    if status in ("complete", "incomplete"):
        q = q.where(LibraryShow.status == status)
    q = q.order_by(LibraryShow.title)
    shows = (await db.execute(q)).scalars().all()

    # availability is tracked per episode; all episodes of a show share the same providers
    eps = (await db.execute(
        select(MissingEpisode).where(MissingEpisode.user_id == user.id)
    )).scalars().all()
    by_show: dict[int, dict] = {}
    for ep in eps:
        info = by_show.setdefault(ep.show_tmdb_id, {"upcoming": 0, "streamable": 0, "services": []})
        if ep.status == "upcoming":
            info["upcoming"] += 1
        elif ep.status == "streamable":
            info["streamable"] += 1
            if not info["services"]:
                info["services"] = ep.streaming_list

    out = []
    for s in shows:
        info = by_show.get(s.tmdb_id, {"upcoming": 0, "streamable": 0, "services": []})
        if status == "upcoming" and not info["upcoming"]:
            continue
        if status == "streamable" and not info["streamable"]:
            continue
        out.append({
            "id": s.id,
            "tmdb_id": s.tmdb_id,
            "plex_key": s.plex_key,
            "title": s.title,
            "year": s.year,
            "poster_path": s.poster_path,
            "episodes_total": s.episodes_total,
            "episodes_present": s.episodes_present,
            "missing_count": s.missing_count,
            "upcoming_count": info["upcoming"],
            "streamable_count": info["streamable"],
            "streaming_services": info["services"],
            "status": s.status,
        })
    return out
