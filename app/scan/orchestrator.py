from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.checkers.audio_subtitle import find_missing_languages
from app.config import Settings
from app.db.models import LibraryMovie, LibraryShow, MissingAudio, MissingEpisode, MissingMovie, NotificationSent, ScanRun, User
from app.matching.movies import find_missing_movies
from app.matching.series import check_show, find_missing_episodes
from app.notifications.notifier import NotificationConfig, Notifier
from app.plex.scanner import PlexScanner
from app.scan.progress import clear_progress, set_progress
from app.scan.rescan import apply_plex_state
from app.streaming.availability import provider_matches_owned
from app.tmdb.cache import (
    ResponseCache,
    get_cached_providers,
    load_response_cache,
    save_response_cache,
    set_cached_providers,
)
from app.tmdb.client import TMDbClient

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ScanOrchestrator:
    def __init__(self, user: User, settings: Settings, db: AsyncSession) -> None:
        self.user = user
        self.settings = settings
        self.db = db
        self._scanner = PlexScanner(user.plex_token, user.server_name)
        self._cache = ResponseCache()
        self._tmdb = TMDbClient(settings.tmdb.api_key, self._cache)
        self._notifier = self._build_notifier()

    async def _load_cache(self) -> None:
        """Fill the TMDb response cache from the DB; call before any scan that uses matching."""
        loaded = await load_response_cache(self.db)
        self._cache = loaded
        self._tmdb = TMDbClient(self.settings.tmdb.api_key, loaded)

    async def _save_cache(self) -> None:
        try:
            await save_response_cache(self.db, self._cache)
        except Exception:
            await self.db.rollback()
            logger.exception("Could not persist TMDb response cache")

    def _build_notifier(self) -> Notifier:
        nc = json.loads(self.user.notification_config) if self.user.notification_config else {}
        return Notifier(NotificationConfig(
            provider=nc.get("provider", ""),
            ntfy_url=nc.get("ntfy_url", "https://ntfy.sh"),
            ntfy_topic=nc.get("ntfy_topic", "pmmx"),
            discord_webhook_url=nc.get("discord_webhook_url", ""),
            pushover_token=nc.get("pushover_token", ""),
            pushover_user=nc.get("pushover_user", ""),
        ))

    def _audio_langs(self) -> list[str]:
        if self.user.preferred_audio_langs:
            return json.loads(self.user.preferred_audio_langs)
        return ["de", "en"]

    def _subtitle_langs(self) -> list[str]:
        if self.user.preferred_subtitle_langs:
            return json.loads(self.user.preferred_subtitle_langs)
        return ["de"]

    def _owned_services(self) -> set[str]:
        if self.user.owned_streaming_services:
            return set(json.loads(self.user.owned_streaming_services))
        return set()

    # ------------------------------------------------------------------

    async def run_full_scan(self) -> None:
        run = ScanRun(user_id=self.user.id, scan_type="full", started_at=_now())
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)

        uid = self.user.id
        set_progress(uid, stage="plex", current_item="Verbinde mit Plex…")
        try:
            await self._load_cache()
            movies =await asyncio.to_thread(self._scanner.get_movies)
            shows = await asyncio.to_thread(self._scanner.get_shows)

            set_progress(uid, stage="movies", movies_total=len(movies), shows_total=len(shows))

            def movie_cb(checked: int, total: int, title: str) -> None:
                set_progress(uid, movies_checked=checked, movies_total=total, current_item=title)

            def show_cb(checked: int, total: int, title: str) -> None:
                set_progress(uid, stage="series", shows_checked=checked, shows_total=total, current_item=title)

            missing_movies, library_movies = await asyncio.to_thread(find_missing_movies, movies, self._tmdb, movie_cb)

            set_progress(uid, stage="series", current_item="")
            missing_eps, library_shows = await asyncio.to_thread(find_missing_episodes, shows, self._tmdb, show_cb)

            set_progress(uid, stage="audio", current_item="Sprachspuren werden geprüft…")
            missing_audio = find_missing_languages(
                movies, shows, self._audio_langs(), self._subtitle_langs()
            )

            await self._save_movies(missing_movies)
            await self._save_episodes(missing_eps)
            await self._save_audio(missing_audio)
            await self._save_library(library_movies, library_shows)
            await self._notify_new_releases(missing_movies, missing_eps)

            set_progress(uid, stage="availability", current_item="Streaming-Verfügbarkeit wird geprüft…")
            region = self.user.streaming_region or "DE"
            owned = self._owned_services()
            await self._check_movie_availability(region, owned)
            await self._check_episode_availability(region, owned)
            set_progress(uid, stage="done", current_item="")

            run.status = "completed"
            run.completed_at = _now()
            await self.db.commit()
            clear_progress(uid)
            logger.info(
                "Full scan done [%s]: %d movies, %d episodes, %d audio",
                self.user.username, len(missing_movies), len(missing_eps), len(missing_audio),
            )
        except Exception as exc:
            run.status = "failed"
            run.error = str(exc)
            run.completed_at = _now()
            await self.db.commit()
            clear_progress(uid)
            logger.exception("Full scan failed for user %s", self.user.username)
            raise
        finally:
            await self._save_cache()
            self._tmdb.close()

    async def run_plex_rescan(self) -> None:
        """Re-read Plex and update statuses from stored data. Makes no TMDb requests."""
        run = ScanRun(user_id=self.user.id, scan_type="plex", started_at=_now())
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)

        uid = self.user.id
        set_progress(uid, stage="plex", current_item="Lese Plex…")
        try:
            movies = await asyncio.to_thread(self._scanner.get_movies)
            shows = await asyncio.to_thread(self._scanner.get_shows)

            set_progress(uid, stage="audio", current_item="Status wird abgeglichen…")
            stats = await apply_plex_state(self.db, uid, movies, shows)
            missing_audio = find_missing_languages(
                movies, shows, self._audio_langs(), self._subtitle_langs()
            )
            await self._save_audio(missing_audio)

            run.status = "completed"
            run.completed_at = _now()
            await self.db.commit()
            clear_progress(uid)
            logger.info("Plex rescan done [%s]: %s", self.user.username, stats)
        except Exception as exc:
            await self.db.rollback()
            run.status = "failed"
            run.error = str(exc)
            run.completed_at = _now()
            await self.db.commit()
            clear_progress(uid)
            logger.exception("Plex rescan failed for user %s", self.user.username)
            raise

    async def run_availability_check(self) -> None:
        run = ScanRun(user_id=self.user.id, scan_type="availability", started_at=_now())
        self.db.add(run)
        await self.db.commit()

        try:
            region = self.user.streaming_region or "DE"
            owned = self._owned_services()

            await self._check_movie_availability(region, owned)
            await self._check_episode_availability(region, owned)

            run.status = "completed"
            run.completed_at = _now()
            await self.db.commit()
        except Exception as exc:
            run.status = "failed"
            run.error = str(exc)
            run.completed_at = _now()
            await self.db.commit()
            logger.exception("Availability check failed for user %s", self.user.username)
            raise
        finally:
            self._tmdb.close()

    async def refresh_show(self, tmdb_id: int, refresh_tmdb: bool = False) -> LibraryShow:
        """Re-check a single show against Plex, without a full scan.

        Plex is read for this show only and TMDb answers come from the cache, so a
        typical refresh (new files were added) costs no TMDb requests. With
        refresh_tmdb the cached TMDb data for the show is dropped first.
        """
        lib = (await self.db.execute(
            select(LibraryShow).where(LibraryShow.user_id == self.user.id, LibraryShow.tmdb_id == tmdb_id)
        )).scalar_one_or_none()
        if lib is None or lib.plex_key is None:
            raise LookupError(f"Show {tmdb_id} not in library")

        await self._load_cache()
        try:
            if refresh_tmdb:
                self._cache.invalidate_where(
                    lambda k: k == f"show:{tmdb_id}" or k.startswith(f"season:{tmdb_id}:")
                )
            # fail before touching the DB if TMDb is unreachable
            await asyncio.to_thread(self._tmdb.get_show, tmdb_id)

            show = await asyncio.to_thread(self._scanner.get_show, lib.plex_key)
            show["tmdb_id"] = tmdb_id  # the match from the last full scan
            missing, entry = await asyncio.to_thread(check_show, show, self._tmdb)
            audio = find_missing_languages([], [show], self._audio_langs(), self._subtitle_langs())

            await self._save_episodes(missing, show_tmdb_id=tmdb_id)
            await self._save_audio(audio, show_plex_key=lib.plex_key)
            await self._check_episode_availability(
                self.user.streaming_region or "DE", self._owned_services(), show_tmdb_id=tmdb_id
            )

            lib.poster_path = entry["poster_path"] or lib.poster_path
            lib.episodes_total = entry["episodes_total"]
            lib.episodes_present = entry["episodes_present"]
            lib.missing_count = entry["missing_count"]
            lib.status = entry["status"]
            lib.last_updated = _now()
            await self.db.commit()
            logger.info("Refreshed show %r [%s]: %d missing", lib.title, self.user.username, len(missing))
            return lib
        finally:
            await self._save_cache()
            self._tmdb.close()

    # ------------------------------------------------------------------

    async def _save_movies(self, items: list[dict]) -> None:
        # Preserve streaming data from previous availability scans
        existing = await self.db.execute(
            select(MissingMovie).where(MissingMovie.user_id == self.user.id)
        )
        old: dict[int, MissingMovie] = {r.tmdb_id: r for r in existing.scalars()}

        await self.db.execute(delete(MissingMovie).where(MissingMovie.user_id == self.user.id))
        for m in items:
            prev = old.get(m["tmdb_id"])
            old_svcs = prev.streaming_services if prev else "[]"
            old_checked = prev.availability_checked_at if prev else None
            status = m["status"]
            if status == "missing" and old_svcs and old_svcs != "[]":
                status = "streamable"
            self.db.add(MissingMovie(
                user_id=self.user.id,
                tmdb_id=m["tmdb_id"],
                title=m["title"],
                year=m.get("year"),
                collection_id=m["collection_id"],
                collection_name=m["collection_name"],
                release_date=m.get("release_date"),
                status=status,
                streaming_services=old_svcs,
                poster_path=m.get("poster_path"),
                last_checked=_now(),
                availability_checked_at=old_checked,
            ))
        await self.db.commit()

    async def _save_episodes(self, items: list[dict], show_tmdb_id: int | None = None) -> None:
        """Replace missing episodes, for one show if show_tmdb_id is given, else for all."""
        scope = [MissingEpisode.user_id == self.user.id]
        if show_tmdb_id is not None:
            scope.append(MissingEpisode.show_tmdb_id == show_tmdb_id)

        # Preserve streaming data keyed by (show_tmdb_id, season, episode)
        existing = await self.db.execute(select(MissingEpisode).where(*scope))
        old: dict[tuple[int, int, int], MissingEpisode] = {
            (r.show_tmdb_id, r.season_number, r.episode_number): r
            for r in existing.scalars()
        }

        await self.db.execute(delete(MissingEpisode).where(*scope))
        for ep in items:
            key = (ep["show_tmdb_id"], ep["season_number"], ep["episode_number"])
            prev = old.get(key)
            old_svcs = prev.streaming_services if prev else "[]"
            old_checked = prev.availability_checked_at if prev else None
            status = ep["status"]
            if status == "missing" and old_svcs and old_svcs != "[]":
                status = "streamable"
            self.db.add(MissingEpisode(
                user_id=self.user.id,
                show_tmdb_id=ep["show_tmdb_id"],
                show_title=ep["show_title"],
                season_number=ep["season_number"],
                episode_number=ep["episode_number"],
                episode_title=ep.get("episode_title", ""),
                air_date=ep.get("air_date"),
                status=status,
                streaming_services=old_svcs,
                last_checked=_now(),
                availability_checked_at=old_checked,
            ))
        await self.db.commit()

    async def _save_audio(self, items: list[dict], show_plex_key: int | None = None) -> None:
        """Replace audio findings, for the episodes of one show if show_plex_key is given."""
        scope = [MissingAudio.user_id == self.user.id]
        if show_plex_key is not None:
            scope.append(MissingAudio.show_plex_key == show_plex_key)
        await self.db.execute(delete(MissingAudio).where(*scope))
        for item in items:
            self.db.add(MissingAudio(
                user_id=self.user.id,
                plex_key=item["plex_key"],
                show_plex_key=item.get("show_plex_key"),
                title=item["title"],
                media_type=item["media_type"],
                missing_audio_langs=json.dumps(item["missing_audio"]),
                missing_subtitle_langs=json.dumps(item["missing_subtitles"]),
                last_checked=_now(),
            ))
        await self.db.commit()

    async def _save_library(self, movies: list[dict], shows: list[dict]) -> None:
        # Deduplicate by tmdb_id — prefer "present" entry if same movie appears in multiple Plex sections
        seen_movies: dict[int, dict] = {}
        for m in movies:
            tid = m["tmdb_id"]
            if tid not in seen_movies or m.get("status") == "present":
                seen_movies[tid] = m

        # Deduplicate shows — prefer entry with more episodes present
        seen_shows: dict[int, dict] = {}
        for s in shows:
            tid = s["tmdb_id"]
            existing = seen_shows.get(tid)
            if existing is None or s.get("episodes_present", 0) > existing.get("episodes_present", 0):
                seen_shows[tid] = s

        existing_lib = await self.db.execute(
            select(LibraryMovie).where(LibraryMovie.user_id == self.user.id)
        )
        old_lib: dict[int, LibraryMovie] = {r.tmdb_id: r for r in existing_lib.scalars()}

        await self.db.execute(delete(LibraryMovie).where(LibraryMovie.user_id == self.user.id))
        for m in seen_movies.values():
            prev = old_lib.get(m["tmdb_id"])
            old_svcs = prev.streaming_services if prev else "[]"
            status = m.get("status", "present")
            if status == "missing" and old_svcs and old_svcs != "[]":
                status = "streamable"
            self.db.add(LibraryMovie(
                user_id=self.user.id,
                tmdb_id=m["tmdb_id"],
                plex_key=m.get("plex_key"),
                title=m["title"],
                year=m.get("year"),
                poster_path=m.get("poster_path"),
                collection_id=m.get("collection_id"),
                collection_name=m.get("collection_name"),
                release_date=m.get("release_date"),
                status=status,
                streaming_services=old_svcs,
            ))

        await self.db.execute(delete(LibraryShow).where(LibraryShow.user_id == self.user.id))
        for s in seen_shows.values():
            self.db.add(LibraryShow(
                user_id=self.user.id,
                tmdb_id=s["tmdb_id"],
                plex_key=s.get("plex_key"),
                title=s["title"],
                year=s.get("year"),
                poster_path=s.get("poster_path"),
                episodes_total=s.get("episodes_total", 0),
                episodes_present=s.get("episodes_present", 0),
                missing_count=s.get("missing_count", 0),
                status=s.get("status", "complete"),
            ))
        await self.db.commit()

    async def _get_providers(self, tmdb_id: int, media_type: str) -> dict[str, list[dict]]:
        """Return watch providers from shared cache; fetch from TMDb on miss."""
        cached = await get_cached_providers(self.db, tmdb_id, media_type)
        if cached is not None:
            return cached
        data = await asyncio.to_thread(self._tmdb.get_watch_providers, tmdb_id, media_type)
        await set_cached_providers(self.db, tmdb_id, media_type, data)
        return data

    async def _check_movie_availability(self, region: str, owned: set[str]) -> None:
        result = await self.db.execute(
            select(MissingMovie).where(
                MissingMovie.user_id == self.user.id,
                MissingMovie.status == "missing",
            )
        )
        for movie in result.scalars().all():
            providers_by_region = await self._get_providers(movie.tmdb_id, "movie")
            all_providers = providers_by_region.get(region, [])
            flatrate = [p for p in all_providers if p.get("type") == "flatrate"]
            movie.availability_checked_at = _now()
            if all_providers:
                movie.streaming_services = json.dumps(all_providers)
                movie.status = "streamable"
                lib_result = await self.db.execute(
                    select(LibraryMovie).where(
                        LibraryMovie.user_id == self.user.id,
                        LibraryMovie.tmdb_id == movie.tmdb_id,
                    )
                )
                lib_movie = lib_result.scalar_one_or_none()
                if lib_movie:
                    lib_movie.streaming_services = json.dumps(all_providers)
                    lib_movie.status = "streamable"
                owned_hits = [p for p in flatrate if provider_matches_owned(p["name"], owned)]
                if owned_hits:
                    await self._send_streamable_notification("movie", str(movie.tmdb_id), movie.title, owned_hits)
        await self.db.commit()

    async def _check_episode_availability(
        self, region: str, owned: set[str], show_tmdb_id: int | None = None
    ) -> None:
        q = select(MissingEpisode).where(
            MissingEpisode.user_id == self.user.id,
            MissingEpisode.status == "missing",
        )
        if show_tmdb_id is not None:
            q = q.where(MissingEpisode.show_tmdb_id == show_tmdb_id)
        result = await self.db.execute(q)
        show_providers: dict[int, list[dict]] = {}
        for ep in result.scalars().all():
            if ep.show_tmdb_id not in show_providers:
                by_region = await self._get_providers(ep.show_tmdb_id, "tv")
                show_providers[ep.show_tmdb_id] = by_region.get(region, [])
            all_providers = show_providers[ep.show_tmdb_id]
            ep.availability_checked_at = _now()
            if all_providers:
                ep.streaming_services = json.dumps(all_providers)
                ep.status = "streamable"
        await self.db.commit()

    async def _notify_new_releases(self, movies: list[dict], episodes: list[dict]) -> None:
        new_movies = [m for m in movies if m["status"] == "missing"]
        if new_movies:
            titles = ", ".join(m["title"] for m in new_movies[:5])
            suffix = f" (+{len(new_movies) - 5} weitere)" if len(new_movies) > 5 else ""
            self._notifier.send(
                title="Neue fehlende Filme erkannt",
                body=f"{titles}{suffix}",
                tags=["movie"],
            )

        new_eps = [e for e in episodes if e["status"] == "missing"]
        if new_eps:
            shows = list({e["show_title"] for e in new_eps})[:5]
            self._notifier.send(
                title=f"Fehlende Episoden: {len(new_eps)} neu",
                body=", ".join(shows),
                tags=["tv"],
            )

    async def _send_streamable_notification(
        self, item_type: str, item_ref: str, title: str, services: list[dict]
    ) -> None:
        # Check not already notified
        exists = await self.db.execute(
            select(NotificationSent).where(
                NotificationSent.user_id == self.user.id,
                NotificationSent.item_type == item_type,
                NotificationSent.item_ref == item_ref,
                NotificationSent.notification_type == "streamable",
            )
        )
        if exists.scalar_one_or_none():
            return

        names = ", ".join(s["name"] for s in services[:3])
        self._notifier.send(
            title=f"Jetzt streambar: {title}",
            body=f"{title} ist jetzt auf {names} verfügbar.",
            tags=["movie", "streaming"],
        )
        self.db.add(NotificationSent(
            user_id=self.user.id,
            item_type=item_type,
            item_ref=item_ref,
            notification_type="streamable",
            sent_at=_now(),
        ))
        await self.db.commit()
