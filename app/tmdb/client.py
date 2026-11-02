from __future__ import annotations

import logging
import time
from datetime import date, timedelta

import requests
import tmdbsimple as tmdb

from app.tmdb.cache import ResponseCache

logger = logging.getLogger(__name__)

_MAX_RETRIES = 5

_DAY = timedelta(days=1)
_WEEK = timedelta(days=7)
_LONG = timedelta(days=30)
_ENDED = {"Ended", "Canceled"}


def _released(raw: str | None) -> bool:
    try:
        return bool(raw) and date.fromisoformat(raw) <= date.today()
    except ValueError:
        return False


def _movie_ttl(data: dict) -> timedelta:
    return _LONG if _released(data.get("release_date")) else _DAY


def _collection_ttl(data: dict) -> timedelta:
    parts = data.get("parts", [])
    return _WEEK if parts and all(_released(p.get("release_date")) for p in parts) else _DAY


def _show_ttl(data: dict) -> timedelta:
    return _LONG if data.get("status") in _ENDED else _DAY


def _find_ttl(data: dict) -> timedelta:
    return _LONG if data.get("id") else _WEEK


class _BearerSession(requests.Session):
    """Sends a v4 read access token as Bearer header instead of the api_key query param."""

    def __init__(self, token: str) -> None:
        super().__init__()
        self.headers["Authorization"] = f"Bearer {token}"

    def request(self, method, url, params=None, **kwargs):
        if isinstance(params, dict):
            params = {k: v for k, v in params.items() if k != "api_key"}
        return super().request(method, url, params=params, **kwargs)


def _is_v4_token(key: str) -> bool:
    # v3 keys are 32 hex chars, v4 read access tokens are JWTs (eyJ...)
    return key.startswith("eyJ") and key.count(".") == 2


class TMDbClient:
    def __init__(self, api_key: str, cache: ResponseCache | None = None) -> None:
        self._cache = cache
        api_key = api_key.strip()
        tmdb.API_KEY = api_key
        if _is_v4_token(api_key):
            tmdb.REQUESTS_SESSION = _BearerSession(api_key)

    def _call(self, fn, **kwargs) -> dict:
        for attempt in range(_MAX_RETRIES):
            try:
                return fn(**kwargs)
            except requests.exceptions.HTTPError as exc:
                if exc.response.status_code == 429:
                    wait = min(int(exc.response.headers.get("Retry-After", 2 ** attempt)), 30)
                    logger.warning("TMDb rate limit — waiting %ds (attempt %d)", wait, attempt + 1)
                    time.sleep(wait)
                    continue
                # the original message contains the request URL including api_key
                url = exc.response.url.split("?", 1)[0]
                raise requests.exceptions.HTTPError(
                    f"{exc.response.status_code} {exc.response.reason} for url: {url}",
                    response=exc.response,
                ) from None
        return fn(**kwargs)

    def _cached(self, key: str, ttl, fetch) -> dict:
        """Return the cached response for key, or fetch, store and return it."""
        if self._cache is not None:
            hit = self._cache.get(key, ttl)
            if hit is not None:
                return hit
        data = fetch()
        if self._cache is not None:
            self._cache.put(key, data)
        return data

    def get_movie(self, tmdb_id: int) -> dict:
        def fetch() -> dict:
            raw = self._call(tmdb.Movies(tmdb_id).info)
            coll = raw.get("belongs_to_collection")
            return {
                "poster_path": raw.get("poster_path"),
                "release_date": raw.get("release_date"),
                "belongs_to_collection": {"id": coll["id"], "name": coll["name"]} if coll else None,
            }
        return self._cached(f"movie:{tmdb_id}", _movie_ttl, fetch)

    def get_collection(self, collection_id: int) -> dict:
        def fetch() -> dict:
            raw = self._call(tmdb.Collections(collection_id).info)
            return {"parts": [
                {k: p.get(k) for k in ("id", "title", "release_date", "poster_path")}
                for p in raw.get("parts", [])
            ]}
        return self._cached(f"collection:{collection_id}", _collection_ttl, fetch)

    def get_show(self, tmdb_id: int) -> dict:
        def fetch() -> dict:
            raw = self._call(tmdb.TV(tmdb_id).info)
            return {
                "poster_path": raw.get("poster_path"),
                "status": raw.get("status"),
                "seasons": [{"season_number": s["season_number"]} for s in raw.get("seasons", [])],
            }
        return self._cached(f"show:{tmdb_id}", _show_ttl, fetch)

    def find_show_id(
        self, tvdb_id: int | None, imdb_id: str | None, title: str, year: int | None
    ) -> int | None:
        """Resolve a TMDb show id from external ids, falling back to a title search.

        Misses are cached too (for a week), so unmatched shows don't cost
        up to three requests on every scan.
        """
        key = f"find:{tvdb_id or ''}:{imdb_id or ''}:{title.lower()}:{year or ''}"
        data = self._cached(key, _find_ttl, lambda: {"id": self._lookup_show_id(tvdb_id, imdb_id, title, year)})
        return data["id"]

    def _lookup_show_id(
        self, tvdb_id: int | None, imdb_id: str | None, title: str, year: int | None
    ) -> int | None:
        for source, value in (("tvdb_id", tvdb_id), ("imdb_id", imdb_id)):
            if not value:
                continue
            try:
                found = self._call(tmdb.Find(value).info, external_source=source)
            except Exception as exc:
                logger.warning("TMDb find %s=%s failed: %s", source, value, exc)
                continue
            results = found.get("tv_results") or []
            if results:
                return results[0]["id"]
        kwargs = {"query": title}
        if year:
            kwargs["first_air_date_year"] = year
        try:
            results = self._call(tmdb.Search().tv, **kwargs).get("results") or []
        except Exception as exc:
            logger.warning("TMDb search for show %r failed: %s", title, exc)
            return None
        return results[0]["id"] if results else None

    def get_season(self, tmdb_id: int, season_number: int, volatile: bool = True) -> dict:
        """volatile=False marks a season that is not expected to change anymore (an older
        season of a running show, or any season of an ended one) and caches it for long."""
        def fetch() -> dict:
            raw = self._call(tmdb.TV_Seasons(tmdb_id, season_number).info)
            return {"episodes": [
                {"episode_number": e["episode_number"], "name": e.get("name", ""), "air_date": e.get("air_date")}
                for e in raw.get("episodes", [])
            ]}
        return self._cached(f"season:{tmdb_id}:{season_number}", _DAY if volatile else _LONG, fetch)

    def get_watch_providers(self, tmdb_id: int, media_type: str) -> dict[str, list[dict]]:
        """Return {region_code: [{"name": str, "provider_id": int}]} for subscription services."""
        if media_type == "movie":
            obj = tmdb.Movies(tmdb_id)
        else:
            obj = tmdb.TV(tmdb_id)
        response = self._call(obj.watch_providers)
        result: dict[str, list[dict]] = {}
        for region, data in response.get("results", {}).items():
            watch_link = data.get("link", "")
            providers: list[dict] = []
            seen: set[int] = set()
            for provider_type in ("flatrate", "rent", "buy"):
                for s in data.get(provider_type, []):
                    pid = s["provider_id"]
                    if pid not in seen:
                        seen.add(pid)
                        providers.append({
                            "name": s["provider_name"],
                            "provider_id": pid,
                            "logo_path": s.get("logo_path"),
                            "type": provider_type,
                            "watch_link": watch_link,
                        })
            if providers:
                result[region] = providers
        return result

    def close(self) -> None:
        pass
