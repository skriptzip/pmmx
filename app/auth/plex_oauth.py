"""Plex PIN-based OAuth — called by FastAPI auth endpoints (Phase 9).

Flow (backend-proxied so no CORS issues in the frontend):
  1. create_pin()           → (pin_id, auth_url)  — return to frontend
  2. poll_pin(pin_id)       → str | None           — poll until token arrives
  3. get_user_info(token)   → dict                 — Plex UUID + display name
  4. list_servers(token)    → list[dict]           — servers the user can reach
"""
from __future__ import annotations

import httpx

_CLIENT_ID = "pmmx-service"
_HEADERS = {
    "Accept": "application/json",
    "X-Plex-Product": "pmmx",
    "X-Plex-Client-Identifier": _CLIENT_ID,
}
_PINS_URL = "https://plex.tv/api/v2/pins"


def create_pin() -> tuple[int, str]:
    """Return (pin_id, auth_url)."""
    resp = httpx.post(_PINS_URL, headers=_HEADERS, params={"strong": "true"})
    resp.raise_for_status()
    data = resp.json()
    pin_id: int = data["id"]
    code: str = data["code"]
    auth_url = (
        f"https://app.plex.tv/auth#"
        f"?clientID={_CLIENT_ID}"
        f"&code={code}"
        f"&context[device][product]=pmmx"
    )
    return pin_id, auth_url


def poll_pin(pin_id: int) -> str | None | bool:
    """Return auth token when login completed, None while pending, False when expired."""
    resp = httpx.get(f"{_PINS_URL}/{pin_id}", headers=_HEADERS)
    if resp.status_code == 404:
        return False  # PIN expired or already consumed
    resp.raise_for_status()
    return resp.json().get("authToken") or None


def get_user_info(token: str) -> dict:
    """Return Plex account info (uuid, username, email, thumb)."""
    resp = httpx.get(
        "https://plex.tv/api/v2/user",
        headers={**_HEADERS, "X-Plex-Token": token},
    )
    resp.raise_for_status()
    d = resp.json()
    return {
        "plex_uuid": d["uuid"],
        "username": d["username"],
        "email": d.get("email", ""),
        "thumb": d.get("thumb", ""),
    }


def list_servers(token: str) -> list[dict]:
    """Return all Plex Media Servers the user can reach."""
    resp = httpx.get(
        "https://plex.tv/api/v2/resources",
        headers={**_HEADERS, "X-Plex-Token": token},
        params={"includeHttps": 1, "includeRelay": 1},
    )
    resp.raise_for_status()
    return [
        {
            "name": r["name"],
            "client_identifier": r["clientIdentifier"],
            "owned": r["owned"],
            "connections": [
                {"uri": c["uri"], "local": c["local"]}
                for c in r.get("connections", [])
            ],
        }
        for r in resp.json()
        if r.get("provides") == "server"
    ]
