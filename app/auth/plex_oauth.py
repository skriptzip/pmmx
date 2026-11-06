"""Plex PIN-based OAuth, called by the FastAPI auth endpoints.

Flow (backend-proxied so no CORS issues in the frontend):
  1. create_pin()                        -> (pin_id, code, client_id, auth_url)
  2. poll_pin(pin_id, code, client_id)   -> token, None while pending, False if expired
  3. get_user_info(token)                -> Plex UUID + display name
  4. list_servers(token)                 -> servers the user can reach

Every login uses its own random client identifier and the PIN code, so a PIN
cannot be polled by someone who only guesses the (sequential) PIN id.
"""
from __future__ import annotations

import secrets

import httpx

_HEADERS = {
    "Accept": "application/json",
    "X-Plex-Product": "pmmx",
}
_SERVICE_CLIENT_ID = "pmmx-service"
_PINS_URL = "https://plex.tv/api/v2/pins"
_TIMEOUT = 15


def create_pin() -> tuple[int, str, str, str]:
    """Return (pin_id, code, client_id, auth_url)."""
    client_id = f"pmmx-{secrets.token_hex(16)}"
    resp = httpx.post(
        _PINS_URL,
        headers={**_HEADERS, "X-Plex-Client-Identifier": client_id},
        params={"strong": "true"},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    pin_id: int = data["id"]
    code: str = data["code"]
    auth_url = (
        f"https://app.plex.tv/auth#"
        f"?clientID={client_id}"
        f"&code={code}"
        f"&context[device][product]=pmmx"
    )
    return pin_id, code, client_id, auth_url


def poll_pin(pin_id: int, code: str, client_id: str) -> str | None | bool:
    """Return auth token when login completed, None while pending, False when expired."""
    resp = httpx.get(
        f"{_PINS_URL}/{pin_id}",
        headers={**_HEADERS, "X-Plex-Client-Identifier": client_id},
        params={"code": code},
        timeout=_TIMEOUT,
    )
    if resp.status_code in (404, 403):
        return False  # PIN expired, consumed or code/client mismatch
    resp.raise_for_status()
    return resp.json().get("authToken") or None


def get_user_info(token: str) -> dict:
    """Return Plex account info (uuid, username, email, thumb)."""
    resp = httpx.get(
        "https://plex.tv/api/v2/user",
        headers={**_HEADERS, "X-Plex-Client-Identifier": _SERVICE_CLIENT_ID, "X-Plex-Token": token},
        timeout=_TIMEOUT,
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
        headers={**_HEADERS, "X-Plex-Client-Identifier": _SERVICE_CLIENT_ID, "X-Plex-Token": token},
        params={"includeHttps": 1, "includeRelay": 1},
        timeout=_TIMEOUT,
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
