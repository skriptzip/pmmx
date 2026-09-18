from __future__ import annotations


def find_missing_languages(
    movies: list[dict],
    shows: list[dict],
    target_audio: list[str],
    target_subtitles: list[str],
) -> list[dict]:
    results: list[dict] = []

    for movie in movies:
        missing_audio = [l for l in target_audio if l not in movie["audio_languages"]]
        missing_subs = [l for l in target_subtitles if l not in movie["subtitle_languages"]]
        if missing_audio or missing_subs:
            results.append({
                "plex_key": movie["plex_key"],
                "title": f"{movie['title']} ({movie['year']})" if movie.get("year") else movie["title"],
                "media_type": "movie",
                "missing_audio": missing_audio,
                "missing_subtitles": missing_subs,
            })

    for show in shows:
        for season in show["seasons"]:
            for ep in season["episodes"]:
                audio_langs = ep.get("audio_languages", [])
                sub_langs = ep.get("subtitle_languages", [])
                missing_audio = [l for l in target_audio if l not in audio_langs]
                missing_subs = [l for l in target_subtitles if l not in sub_langs]
                if missing_audio or missing_subs:
                    results.append({
                        "plex_key": ep["plex_key"],
                        "title": (
                            f"{show['title']} "
                            f"S{season['season_number']:02d}E{ep['episode_number']:02d}"
                        ),
                        "media_type": "episode",
                        "missing_audio": missing_audio,
                        "missing_subtitles": missing_subs,
                    })

    return results
