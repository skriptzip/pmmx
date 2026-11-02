from __future__ import annotations

import logging

from plexapi.myplex import MyPlexAccount
from plexapi.server import PlexServer
from plexapi.video import Movie, Show

logger = logging.getLogger(__name__)


class PlexScanner:
    """Stateless Plex scanner. token + server_name come from the authenticated
    user's DB record (populated during Plex OAuth login)."""

    def __init__(self, token: str, server_name: str) -> None:
        self.token = token
        self.server_name = server_name
        self._server: PlexServer | None = None

    def connect(self) -> PlexServer:
        logger.info("Connecting to plex.tv (server: %s)...", self.server_name)
        account = MyPlexAccount(token=self.token)
        self._server = account.resource(self.server_name).connect()
        logger.info("Connected: %s (version %s)", self._server.friendlyName, self._server.version)
        return self._server

    @property
    def server(self) -> PlexServer:
        if self._server is None:
            self.connect()
        return self._server

    # ------------------------------------------------------------------

    def get_movies(self) -> list[dict]:
        results: list[dict] = []
        for section in self.server.library.sections():
            if section.type != "movie":
                continue
            logger.info("Scanning movie library: %s", section.title)
            for movie in section.all():
                results.append(self._extract_movie(movie))
        logger.info("Movies found: %d", len(results))
        return results

    def get_shows(self) -> list[dict]:
        results: list[dict] = []
        for section in self.server.library.sections():
            if section.type != "show":
                continue
            logger.info("Scanning TV library: %s", section.title)
            for show in section.all():
                results.append(self._extract_show(show))
        logger.info("Shows found: %d", len(results))
        return results

    # ------------------------------------------------------------------

    def _extract_movie(self, movie: Movie) -> dict:
        audio: set[str] = set()
        subs: set[str] = set()
        for media in movie.media:
            for part in media.parts:
                audio.update(s.languageCode for s in part.audioStreams() if s.languageCode)
                subs.update(s.languageCode for s in part.subtitleStreams() if s.languageCode)
        return {
            "plex_key": movie.ratingKey,
            "title": movie.title,
            "year": movie.year,
            "tmdb_id": self._guid(movie, "tmdb"),
            "imdb_id": self._guid(movie, "imdb"),
            "audio_languages": sorted(audio),
            "subtitle_languages": sorted(subs),
        }

    def _extract_show(self, show: Show) -> dict:
        seasons = []
        for season in show.seasons():
            episodes = []
            for ep in season.episodes():
                audio: set[str] = set()
                subs: set[str] = set()
                for media in ep.media:
                    for part in media.parts:
                        audio.update(s.languageCode for s in part.audioStreams() if s.languageCode)
                        subs.update(s.languageCode for s in part.subtitleStreams() if s.languageCode)
                episodes.append({
                    "episode_number": ep.index,
                    "title": ep.title,
                    "plex_key": ep.ratingKey,
                    "audio_languages": sorted(audio),
                    "subtitle_languages": sorted(subs),
                })
            seasons.append({
                "season_number": season.index,
                "episode_count": len(episodes),
                "episodes": episodes,
            })
        return {
            "plex_key": show.ratingKey,
            "title": show.title,
            "year": show.year,
            "tmdb_id": self._guid(show, "tmdb"),
            "tvdb_id": self._guid(show, "tvdb"),
            "imdb_id": self._guid(show, "imdb"),
            "seasons": seasons,
        }

    @staticmethod
    def _guid(item, source: str) -> int | str | None:
        prefix = f"{source}://"
        for guid in item.guids:
            if guid.id.startswith(prefix):
                raw = guid.id[len(prefix):]
                if source == "imdb":
                    return raw
                try:
                    return int(raw)
                except ValueError:
                    return None
        # legacy agents expose only item.guid, e.g. com.plexapp.agents.thetvdb://12345?lang=de
        legacy = {"tmdb": "themoviedb", "tvdb": "thetvdb", "imdb": "imdb"}[source]
        marker = f"com.plexapp.agents.{legacy}://"
        if (item.guid or "").startswith(marker):
            raw = item.guid[len(marker):].split("?", 1)[0]
            if source == "imdb":
                return raw
            try:
                return int(raw)
            except ValueError:
                return None
        return None
