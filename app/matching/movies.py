from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date

from app.tmdb.client import TMDbClient

logger = logging.getLogger(__name__)

ProgressCb = Callable[[int, int, str], None]  # (checked, total, current_title)


def find_missing_movies(
    plex_movies: list[dict],
    tmdb: TMDbClient,
    on_progress: ProgressCb | None = None,
) -> tuple[list[dict], list[dict]]:
    """Compare Plex library against TMDb collections.

    Returns (missing, library_all) where library_all contains every
    Plex-present movie enriched with TMDb metadata plus all missing
    collection parts.
    """
    plex_ids = {m["tmdb_id"] for m in plex_movies if m["tmdb_id"]}
    total = len([m for m in plex_movies if m["tmdb_id"]])

    collections: dict[int, dict] = {}
    library: list[dict] = []
    checked = 0

    for movie in plex_movies:
        if not movie["tmdb_id"]:
            continue
        checked += 1
        if on_progress:
            on_progress(checked, total, movie["title"])
        try:
            details = tmdb.get_movie(movie["tmdb_id"])
        except Exception as exc:
            logger.warning("TMDb lookup failed for tmdb:%d — %s", movie["tmdb_id"], exc)
            details = {}

        coll = details.get("belongs_to_collection")
        if coll:
            cid = coll["id"]
            if cid not in collections:
                collections[cid] = {"name": coll["name"], "present": set()}
            collections[cid]["present"].add(movie["tmdb_id"])

        library.append({
            "tmdb_id": movie["tmdb_id"],
            "plex_key": movie.get("plex_key"),
            "title": movie["title"],
            "year": movie.get("year"),
            "poster_path": details.get("poster_path"),
            "collection_id": coll["id"] if coll else None,
            "collection_name": coll["name"] if coll else None,
            "release_date": details.get("release_date"),
            "status": "present",
        })

    missing: list[dict] = []
    today = date.today()

    for cid, data in collections.items():
        try:
            coll_details = tmdb.get_collection(cid)
        except Exception as exc:
            logger.warning("TMDb collection %d failed — %s", cid, exc)
            continue

        for part in coll_details.get("parts", []):
            if part["id"] in plex_ids:
                continue

            raw_date = part.get("release_date") or ""
            release: date | None = None
            if raw_date:
                try:
                    release = date.fromisoformat(raw_date)
                except ValueError:
                    pass

            status = "upcoming" if (not release or release > today) else "missing"

            entry = {
                "tmdb_id": part["id"],
                "title": part["title"],
                "year": int(raw_date[:4]) if raw_date else None,
                "collection_id": cid,
                "collection_name": data["name"],
                "release_date": raw_date or None,
                "status": status,
                "poster_path": part.get("poster_path"),
            }
            missing.append(entry)
            library.append({**entry, "plex_key": None})

    logger.info("Missing movies found: %d, library total: %d", len(missing), len(library))
    return missing, library
