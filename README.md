# pmmx: Plex Missing-Media-Scanner

pmmx scans your Plex library and shows you what is missing: incomplete movie collections, missing episodes and files without your preferred audio or subtitle languages. For missing titles it also checks which streaming service offers them.

<table>
  <tr>
    <td width="72%" valign="middle"><img src="docs/screenshots/dashboard.png" alt="Dashboard" width="100%"></td>
    <td width="28%" valign="middle"><img src="docs/screenshots/dashboard-mobile.png" alt="Mobile view" width="100%"></td>
  </tr>
</table>

## Features

- Finds gaps in movie collections and missing episodes of your shows (via TMDb)
- Finds files that lack your audio or subtitle languages
- Shows where missing titles can be streamed, rented or bought (via Watchmode)
- Notifications via ntfy, Discord or Pushover
- Daily scheduled scans, plus a quick Plex-only rescan without TMDb requests
- Sign-in with Plex, settings per user
- Responsive web app, native apps prepared via Capacitor

| Library | Streaming details |
|---|---|
| ![Library](docs/screenshots/library.png) | ![Details](docs/screenshots/movie-detail.png) |

| Language tracks | Settings |
|---|---|
| ![Audio](docs/screenshots/audio.png) | ![Settings](docs/screenshots/settings.png) |

## Installation

You need Docker with Compose and a [TMDb API key](https://www.themoviedb.org/settings/api).

1. Clone the repository and copy `.env.example` to `.env`.
2. Set `POSTGRES_PASSWORD`, `SECRET_KEY` and `TMDB__API_KEY`. Optionally add `STREAMING__API_KEY` (Watchmode) for the streaming check.
3. Start it:

   ```bash
   docker compose up -d --build
   ```

4. Open `http://localhost` and sign in with your Plex account.

For a public setup behind Traefik, set `DOMAIN` in `.env` and restrict access with `AUTH__ALLOWED_USERS`, otherwise any Plex user can sign in. A Coolify preset is available in `docker-compose.coolify.yml`.

## Configuration

Everything is configured via environment variables (defaults in `app/config.py`). Nested keys use a double underscore, e.g. `TMDB__API_KEY`. Languages, streaming services, region and notifications are set in the app under **Settings**.

## Development

```bash
uv sync
uv run python -m app.server    # API on :8000, needs PostgreSQL via DATABASE__URL

cd frontend
pnpm install
pnpm dev                       # proxies /api to :8000
```

## License

MIT, see [LICENSE](LICENSE).
