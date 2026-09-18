from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date

from app.tmdb.client import TMDbClient

logger = logging.getLogger(__name__)

ProgressCb = Callable[[int, int, str], None]  # (checked, total, current_title)


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
    total = len([s for s in plex_shows if s["tmdb_id"]])
    checked = 0

    for show in plex_shows:
        if not show["tmdb_id"]:
            continue
        checked += 1
        if on_progress:
            on_progress(checked, total, show["title"])

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
            show_library.append({
                "tmdb_id": show["tmdb_id"],
                "plex_key": show.get("plex_key"),
                "title": show["title"],
                "year": show.get("year"),
                "poster_path": None,
                "episodes_total": episodes_present,
                "episodes_present": episodes_present,
                "missing_count": 0,
                "status": "complete",
            })
            continue

        episodes_total = 0
        show_missing = 0

        for season_meta in show_details.get("seasons", []):
            season_num = season_meta["season_number"]
            if season_num == 0:
                continue

            try:
                season = tmdb.get_season(show["tmdb_id"], season_num)
            except Exception as exc:
                logger.warning("TMDb season %d s%d failed — %s", show["tmdb_id"], season_num, exc)
                continue

            for ep in season.get("episodes", []):
                ep_num = ep["episode_number"]
                episodes_total += 1

                if (season_num, ep_num) in present:
                    continue

                show_missing += 1

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

        show_library.append({
            "tmdb_id": show["tmdb_id"],
            "plex_key": show.get("plex_key"),
            "title": show["title"],
            "year": show.get("year"),
            "poster_path": show_details.get("poster_path"),
            "episodes_total": episodes_total,
            "episodes_present": episodes_present,
            "missing_count": show_missing,
            "status": "complete" if show_missing == 0 else "incomplete",
        })

    logger.info("Missing episodes found: %d, shows in library: %d", len(missing), len(show_library))
    return missing, show_library
