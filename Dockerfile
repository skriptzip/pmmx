FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --frozen

COPY app/ ./app/

RUN useradd --system --no-create-home pmmx && chown -R pmmx /app
USER pmmx

ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# Use the venv python directly: `uv run` needs a writable cache dir,
# which the unprivileged user (no home directory) does not have.
CMD ["python", "-m", "app.server"]
