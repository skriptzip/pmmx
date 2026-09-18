from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)


@dataclass
class NotificationConfig:
    provider: str = ""
    ntfy_url: str = "https://ntfy.sh"
    ntfy_topic: str = "pmmx"
    discord_webhook_url: str = ""
    pushover_token: str = ""
    pushover_user: str = ""


class Notifier:
    def __init__(self, config: NotificationConfig) -> None:
        self._cfg = config

    def send(self, title: str, body: str, tags: list[str] | None = None) -> None:
        try:
            if self._cfg.provider == "ntfy":
                self._ntfy(title, body, tags or [])
            elif self._cfg.provider == "discord":
                self._discord(title, body)
            elif self._cfg.provider == "pushover":
                self._pushover(title, body)
        except Exception as exc:
            logger.warning("Notification failed: %s", exc)

    def _ntfy(self, title: str, body: str, tags: list[str]) -> None:
        httpx.post(
            f"{self._cfg.ntfy_url.rstrip('/')}/{self._cfg.ntfy_topic}",
            content=body.encode(),
            headers={"Title": title, "Tags": ",".join(tags) if tags else "movie"},
            timeout=10,
        )

    def _discord(self, title: str, body: str) -> None:
        if not self._cfg.discord_webhook_url:
            return
        httpx.post(
            self._cfg.discord_webhook_url,
            json={"content": f"**{title}**\n{body}"},
            timeout=10,
        )

    def _pushover(self, title: str, body: str) -> None:
        if not self._cfg.pushover_token:
            return
        httpx.post(
            "https://api.pushover.net/1/messages.json",
            data={
                "token": self._cfg.pushover_token,
                "user": self._cfg.pushover_user,
                "title": title,
                "message": body,
            },
            timeout=10,
        )
