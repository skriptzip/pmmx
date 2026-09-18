from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.config import get_settings
from app.db.database import get_session_factory
from app.db.models import User
from app.scan.orchestrator import ScanOrchestrator

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()


async def _run_full_scan_all() -> None:
    settings = get_settings()
    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(select(User).where(User.server_name != ""))
        users = result.scalars().all()

    for user in users:
        async with factory() as db:
            user = await db.get(User, user.id)
            try:
                await ScanOrchestrator(user, settings, db).run_full_scan()
            except Exception:
                logger.exception("Scheduled full scan failed for user %s", user.username)


async def _run_availability_check_all() -> None:
    settings = get_settings()
    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(select(User).where(User.server_name != ""))
        users = result.scalars().all()

    for user in users:
        async with factory() as db:
            user = await db.get(User, user.id)
            try:
                await ScanOrchestrator(user, settings, db).run_availability_check()
            except Exception:
                logger.exception("Scheduled availability check failed for user %s", user.username)


def start_scheduler() -> None:
    settings = get_settings()
    _scheduler.add_job(
        _run_full_scan_all,
        trigger=CronTrigger.from_crontab(settings.scan.full_scan_cron),
        id="full_scan",
        replace_existing=True,
    )
    _scheduler.add_job(
        _run_availability_check_all,
        trigger=CronTrigger.from_crontab(settings.scan.availability_check_cron),
        id="availability_check",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started")


def shutdown_scheduler() -> None:
    _scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
