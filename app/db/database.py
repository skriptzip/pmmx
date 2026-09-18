from __future__ import annotations

from sqlalchemy import inspect as sa_inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import Base

_engine = None
_session_factory: async_sessionmaker | None = None


def _get_engine():
    global _engine
    if _engine is None:
        from app.config import get_settings
        _engine = create_async_engine(get_settings().database.url, echo=False)
    return _engine


def get_session_factory() -> async_sessionmaker:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(_get_engine(), expire_on_commit=False)
    return _session_factory


def _sync_schema(sync_conn) -> None:
    """Create missing tables and add missing columns — runs on every startup."""
    Base.metadata.create_all(sync_conn)

    inspector = sa_inspect(sync_conn)
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name not in existing:
                col_type = col.type.compile(dialect=sync_conn.dialect)
                sync_conn.execute(
                    text(f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}")
                )


async def init_db() -> None:
    async with _get_engine().begin() as conn:
        await conn.run_sync(_sync_schema)


async def get_db() -> AsyncSession:
    async with get_session_factory()() as session:
        yield session
