from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel


class TMDbConfig(BaseModel):
    api_key: str


class ScanConfig(BaseModel):
    full_scan_cron: str = "0 3 * * *"
    availability_check_cron: str = "0 2 * * *"


class DatabaseConfig(BaseModel):
    url: str = "postgresql+asyncpg://pmmx:pmmx@db:5432/pmmx"


class Settings(BaseModel):
    secret_key: str = "change-me"
    tmdb: TMDbConfig
    scan: ScanConfig = ScanConfig()
    database: DatabaseConfig = DatabaseConfig()


def _deep_merge(base: dict, override: dict) -> dict:
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _env_overrides() -> dict:
    overrides: dict = {}
    for key, value in os.environ.items():
        parts = key.lower().split("__")
        if len(parts) < 2:
            continue
        node = overrides
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = value
    return overrides


def load_settings(config_path: str = "config.yaml") -> Settings:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    with open(path) as f:
        data = yaml.safe_load(f)
    data = _deep_merge(data, _env_overrides())
    return Settings(**data)


@lru_cache(maxsize=1)
def get_settings(config_path: str = "config.yaml") -> Settings:
    return load_settings(config_path)
