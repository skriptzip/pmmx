"""Validation of user-supplied notification URLs (SSRF protection).

Users can enter their own ntfy server or Discord webhook. The backend then makes
requests to that address, so it must not be usable to reach internal services
(database, other containers, cloud metadata, localhost).
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit

_DISCORD_HOSTS = {"discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"}


def _is_public(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return addr.is_global and not addr.is_multicast


def validate_url(url: str, internal_hosts: list[str] | None = None) -> str:
    """Return the URL if it is safe to call, otherwise raise ValueError.

    Hosts listed in ``internal_hosts`` (e.g. the bundled ``ntfy`` container) may
    resolve to private addresses. Everything else must resolve to public ones.
    """
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https"):
        raise ValueError("Only http and https URLs are allowed")
    host = parts.hostname
    if not host:
        raise ValueError("URL has no host")
    if parts.username or parts.password:
        raise ValueError("Credentials in URLs are not allowed")
    if host.lower() in {h.lower() for h in (internal_hosts or [])}:
        return url
    try:
        infos = socket.getaddrinfo(host, parts.port or (443 if parts.scheme == "https" else 80))
    except socket.gaierror:
        raise ValueError("Host cannot be resolved")
    for info in infos:
        if not _is_public(info[4][0]):
            raise ValueError("URL points to a non-public address")
    return url


def validate_discord_url(url: str) -> str:
    parts = urlsplit(url.strip())
    if parts.scheme != "https" or (parts.hostname or "").lower() not in _DISCORD_HOSTS:
        raise ValueError("Discord webhook must be an https URL on discord.com")
    if not parts.path.startswith("/api/webhooks/"):
        raise ValueError("Not a Discord webhook URL")
    return url
