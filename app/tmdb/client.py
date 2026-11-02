from __future__ import annotations

import logging
import time

import requests
import tmdbsimple as tmdb

logger = logging.getLogger(__name__)

_MAX_RETRIES = 5


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
    def __init__(self, api_key: str) -> None:
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

    def get_movie(self, tmdb_id: int) -> dict:
        return self._call(tmdb.Movies(tmdb_id).info, append_to_response="belongs_to_collection")

    def get_collection(self, collection_id: int) -> dict:
        return self._call(tmdb.Collections(collection_id).info)

    def get_show(self, tmdb_id: int) -> dict:
        return self._call(tmdb.TV(tmdb_id).info)

    def get_season(self, tmdb_id: int, season_number: int) -> dict:
        return self._call(tmdb.TV_Seasons(tmdb_id, season_number).info)

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
