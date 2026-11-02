"""Dev-Helfer: Plex-Bibliothek direkt testen ohne laufenden Server.

Verwendung:
    uv run python -m app.main --token <PLEX_TOKEN> --server "Mein Server"

Credentials kommen NICHT aus der Konfiguration — die gehören dem jeweiligen
Nutzer und werden über den OAuth-Login in der DB gespeichert.
"""
from __future__ import annotations

import argparse
import logging

from app.plex.scanner import PlexScanner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

_PREVIEW = 5


def main() -> None:
    parser = argparse.ArgumentParser(description="pmmx dev scan")
    parser.add_argument("--token", required=True, help="Plex auth token")
    parser.add_argument("--server", required=True, help="Plex server name")
    args = parser.parse_args()

    scanner = PlexScanner(token=args.token, server_name=args.server)

    print("\n=== Movies ===")
    movies = scanner.get_movies()
    for m in movies[:_PREVIEW]:
        tmdb = f"tmdb:{m['tmdb_id']}" if m["tmdb_id"] else "no-tmdb"
        print(f"  [{tmdb}] {m['title']} ({m['year']}) | audio={m['audio_languages']} subs={m['subtitle_languages']}")
    if len(movies) > _PREVIEW:
        print(f"  … and {len(movies) - _PREVIEW} more")

    print("\n=== Shows ===")
    shows = scanner.get_shows()
    for s in shows[:_PREVIEW]:
        tmdb = f"tmdb:{s['tmdb_id']}" if s["tmdb_id"] else "no-tmdb"
        seasons = ", ".join(f"S{se['season_number']}({se['episode_count']}ep)" for se in s["seasons"])
        print(f"  [{tmdb}] {s['title']} ({s['year']}) | {seasons}")
    if len(shows) > _PREVIEW:
        print(f"  … and {len(shows) - _PREVIEW} more")

    print(f"\nTotal: {len(movies)} movies, {len(shows)} shows")


if __name__ == "__main__":
    main()
