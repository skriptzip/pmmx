from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

Stage = Literal["starting", "plex", "movies", "series", "audio", "availability", "done"]

@dataclass
class ScanProgress:
    stage: Stage = "starting"
    movies_total: int = 0
    movies_checked: int = 0
    shows_total: int = 0
    shows_checked: int = 0
    current_item: str = ""
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

# user_id → ScanProgress (in-memory, reset on each scan)
_store: dict[int, ScanProgress] = {}
_lock = threading.Lock()


def set_progress(user_id: int, **kwargs) -> None:
    with _lock:
        if user_id not in _store:
            _store[user_id] = ScanProgress()
        for k, v in kwargs.items():
            setattr(_store[user_id], k, v)


def get_progress(user_id: int) -> ScanProgress | None:
    with _lock:
        return _store.get(user_id)


def clear_progress(user_id: int) -> None:
    with _lock:
        _store.pop(user_id, None)
