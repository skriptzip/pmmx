from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date

from app.tmdb.client import TMDbClient

logger = logging.getLogger(__name__)

ProgressCb = Callable[[int, int, str], None]  # (checked, total, current_title)

_ENDED = {"Ended", "Canceled"}


def check_show(
    show: dict, tmdb: TMDbClient, today: date | None = None
) -> tuple[list[dict], dict] | None:
    """Compare one Plex show against its TMDb episode list.

    Returns (missing_episodes, library_entry), or None if the show can't be
    matched to TMDb.
    """
    today = today or date.today()

    if not show["tmdb_id"]:
        show["tmdb_id"] = tmdb.find_show_id(
            show.get("tvdb_id"), show.get("imdb_id"), show["title"], show.get("year")
        )
        if not show["tmdb_id"]:
            logger.warning("No TMDb match for show %r, skipping", show["title"])
            return None

    present: set[tuple[int, int]] = {
        (s["season_number"], ep["episode_number"])
        for s in show["seasons"]
        for ep in s["episodes"]
    }
    episodes_present = len(present)

    try:
        show_details = tmdb.get_show(show["tmdb_id"])
    except Exception as exc:
        logger.warning("TMDb show %d failed — %s", show["tmdb_id"], exc)
        return [], {
            "tmdb_id": show["tmdb_id"],
            "plex_key": show.get("plex_key"),
            "title": show["title"],
            "year": show.get("year"),
            "poster_path": None,
            "episodes_total": episodes_present,
            "episodes_present": episodes_present,
            "missing_count": 0,
            "status": "complete",
        }

    seasons = [s["season_number"] for s in show_details.get("seasons", []) if s["season_number"] != 0]
    last_season = max(seasons, default=0)
    running = show_details.get("status") not in _ENDED

    missing: list[dict] = []
    episodes_total = 0

    for season_num in seasons:
        try:
            # only the newest season of a running show can still change
            season = tmdb.get_season(
                show["tmdb_id"], season_num, volatile=running and season_num == last_season
            )
        except Exception as exc:
            logger.warning("TMDb season %d s%d failed — %s", show["tmdb_id"], season_num, exc)
            continue

        for ep in season.get("episodes", []):
            ep_num = ep["episode_number"]
            episodes_total += 1

            if (season_num, ep_num) in present:
                continue

            raw_date = ep.get("air_date") or ""
            air: date | None = None
            if raw_date:
                try:
                    air = date.fromisoformat(raw_date)
                except ValueError:
                    pass

            status = "upcoming" if (not air or air > today) else "missing"

            missing.append({
                "show_tmdb_id": show["tmdb_id"],
                "show_title": show["title"],
                "season_number": season_num,
                "episode_number": ep_num,
                "episode_title": ep.get("name", ""),
                "air_date": raw_date or None,
                "status": status,
            })

    return missing, {
        "tmdb_id": show["tmdb_id"],
        "plex_key": show.get("plex_key"),
        "title": show["title"],
        "year": show.get("year"),
        "poster_path": show_details.get("poster_path"),
        "episodes_total": episodes_total,
        "episodes_present": episodes_present,
        "missing_count": len(missing),
        "status": "complete" if not missing else "incomplete",
    }


def find_missing_episodes(
    plex_shows: list[dict],
    tmdb: TMDbClient,
    on_progress: ProgressCb | None = None,
) -> tuple[list[dict], list[dict]]:
    """Compare Plex library against TMDb episode lists.

    Returns (missing_episodes, show_library) where show_library has one
    entry per show with episode counts and completeness status.
    """
    missing: list[dict] = []
    show_library: list[dict] = []
    today = date.today()
    total = len(plex_shows)

    for checked, show in enumerate(plex_shows, start=1):
        if on_progress:
            on_progress(checked, total, show["title"])
        result = check_show(show, tmdb, today)
        if result is None:
            continue
        show_missing, entry = result
        missing.extend(show_missing)
        show_library.append(entry)

    logger.info("Missing episodes found: %d, shows in library: %d", len(missing), len(show_library))
    return missing, show_library
