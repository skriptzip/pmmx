from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import MissingAudio, MissingEpisode, MissingMovie, User

router = APIRouter()

StatusFilter = Literal["all", "missing", "upcoming", "streamable"]


@router.get("/movies")
async def get_missing_movies(
    status: StatusFilter = Query("all"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(MissingMovie).where(MissingMovie.user_id == user.id)
    if status != "all":
        q = q.where(MissingMovie.status == status)
    result = await db.execute(q.order_by(MissingMovie.collection_name, MissingMovie.release_date))
    return [
        {
            "id": m.id,
            "tmdb_id": m.tmdb_id,
            "title": m.title,
            "year": m.year,
            "collection_id": m.collection_id,
            "collection_name": m.collection_name,
            "release_date": m.release_date,
            "status": m.status,
            "streaming_services": m.streaming_list,
            "poster_path": m.poster_path,
            "last_checked": m.last_checked.isoformat() if m.last_checked else None,
        }
        for m in result.scalars().all()
    ]


@router.get("/episodes")
async def get_missing_episodes(
    status: StatusFilter = Query("all"),
    show_tmdb_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(MissingEpisode).where(MissingEpisode.user_id == user.id)
    if status != "all":
        q = q.where(MissingEpisode.status == status)
    if show_tmdb_id:
        q = q.where(MissingEpisode.show_tmdb_id == show_tmdb_id)
    result = await db.execute(
        q.order_by(MissingEpisode.show_title, MissingEpisode.season_number, MissingEpisode.episode_number)
    )
    return [
        {
            "id": ep.id,
            "show_tmdb_id": ep.show_tmdb_id,
            "show_title": ep.show_title,
            "season_number": ep.season_number,
            "episode_number": ep.episode_number,
            "episode_title": ep.episode_title,
            "air_date": ep.air_date,
            "status": ep.status,
            "streaming_services": ep.streaming_list,
            "last_checked": ep.last_checked.isoformat() if ep.last_checked else None,
        }
        for ep in result.scalars().all()
    ]


@router.get("/audio")
async def get_missing_audio(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MissingAudio).where(MissingAudio.user_id == user.id).order_by(MissingAudio.title)
    )
    machine_id = user.server_client_id or ""
    return [
        {
            "id": a.id,
            "plex_key": a.plex_key,
            "title": a.title,
            "media_type": a.media_type,
            "missing_audio": json.loads(a.missing_audio_langs or "[]"),
            "missing_subtitles": json.loads(a.missing_subtitle_langs or "[]"),
            "last_checked": a.last_checked.isoformat() if a.last_checked else None,
            "plex_link": (
                f"https://app.plex.tv/desktop/#!/server/{machine_id}"
                f"/details?key=%2Flibrary%2Fmetadata%2F{a.plex_key}"
            ) if machine_id else None,
        }
        for a in result.scalars().all()
    ]
