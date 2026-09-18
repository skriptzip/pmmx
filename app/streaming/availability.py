from __future__ import annotations

# Streaming availability is fetched via the TMDb Watch Providers API (/watch/providers).
# This module provides name-normalisation so the user's stored service IDs (e.g. "disney_plus")
# can be matched against the provider_name strings TMDb returns (e.g. "Disney Plus").

_SERVICE_ALIASES: dict[str, list[str]] = {
    "netflix": ["netflix"],
    "disney_plus": ["disney plus", "disney+"],
    "amazon_prime": ["amazon prime video", "prime video", "amazon video"],
    "apple_tv_plus": ["apple tv plus", "apple tv+"],
    "hbo_max": ["max", "hbo max"],
    "paramount_plus": ["paramount plus", "paramount+"],
    "sky": ["sky go", "sky"],
    "joyn": ["joyn"],
    "zdf_mediathek": ["zdfmediathek", "zdf mediathek"],
    "ard_mediathek": ["ard mediathek", "ard plus"],
}


def provider_matches_owned(provider_name: str, owned: set[str]) -> bool:
    normalized = provider_name.lower()
    for service_id in owned:
        aliases = _SERVICE_ALIASES.get(service_id, [service_id.replace("_", " ")])
        if any(alias in normalized for alias in aliases):
            return True
    return False
