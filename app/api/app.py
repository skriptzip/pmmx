from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from app.api.auth import router as auth_router
from app.api.library import router as library_router
from app.api.missing import router as missing_router
from app.api.scan import router as scan_router
from app.api.settings_routes import router as settings_router
from app.config import get_settings
from app.db.database import get_session_factory, init_db
from app.db.models import ScanRun
from app.scheduler.jobs import shutdown_scheduler, start_scheduler


async def _cleanup_stale_runs() -> None:
    """Mark any scan runs left in 'running' state (from a prior crash/restart) as failed."""
    async with get_session_factory()() as db:
        await db.execute(
            update(ScanRun)
            .where(ScanRun.status == "running")
            .values(
                status="failed",
                error="Server neugestartet, Scan wurde unterbrochen",
                completed_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await _cleanup_stale_runs()
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="pmmx API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().auth.cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(missing_router, prefix="/missing", tags=["missing"])
app.include_router(library_router, prefix="/library", tags=["library"])
app.include_router(settings_router, prefix="/settings", tags=["settings"])
app.include_router(scan_router, prefix="/scan", tags=["scan"])


@app.get("/health")
async def health():
    return {"status": "ok"}
