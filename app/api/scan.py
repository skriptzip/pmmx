from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.config import get_settings
from app.db.database import get_session_factory
from app.db.models import ScanRun, User
from app.scan.orchestrator import ScanOrchestrator

router = APIRouter()


class ScanTriggerBody(BaseModel):
    scan_type: Literal["full", "availability"] = "full"


async def _run_scan(user_id: int, scan_type: str) -> None:
    settings = get_settings()
    async with get_session_factory()() as db:
        user = await db.get(User, user_id)
        if not user:
            return
        orc = ScanOrchestrator(user, settings, db)
        if scan_type == "availability":
            await orc.run_availability_check()
        else:
            await orc.run_full_scan()


@router.post("/trigger")
async def trigger_scan(
    body: ScanTriggerBody,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    background_tasks.add_task(_run_scan, user.id, body.scan_type)
    return {"message": "Scan started", "scan_type": body.scan_type}


@router.get("/progress")
async def scan_progress(user: User = Depends(get_current_user)):
    from app.scan.progress import get_progress
    p = get_progress(user.id)
    if not p:
        return None
    return {
        "stage": p.stage,
        "movies_total": p.movies_total,
        "movies_checked": p.movies_checked,
        "shows_total": p.shows_total,
        "shows_checked": p.shows_checked,
        "current_item": p.current_item,
        "started_at": p.started_at.isoformat(),
    }


@router.get("/status")
async def scan_status(
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScanRun)
        .where(ScanRun.user_id == user.id)
        .order_by(ScanRun.started_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": r.id,
            "scan_type": r.scan_type,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "status": r.status,
            "error": r.error,
        }
        for r in result.scalars().all()
    ]
