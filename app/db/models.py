from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, String, func
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    plex_uuid = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, nullable=False)
    email = Column(String, default="")
    thumb = Column(String, default="")
    plex_token = Column(String, nullable=False)
    server_name = Column(String, default="")
    server_client_id = Column(String, default="")
    preferred_audio_langs = Column(Text, default=None)
    preferred_subtitle_langs = Column(Text, default=None)
    owned_streaming_services = Column(Text, default=None)
    streaming_region = Column(Text, default=None)
    notification_config = Column(Text, default=None)
    created_at = Column(DateTime(timezone=True), default=_now)
    last_login = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    missing_movies = relationship("MissingMovie", back_populates="user", cascade="all, delete-orphan")
    missing_episodes = relationship("MissingEpisode", back_populates="user", cascade="all, delete-orphan")
    missing_audio = relationship("MissingAudio", back_populates="user", cascade="all, delete-orphan")
    library_movies = relationship("LibraryMovie", back_populates="user", cascade="all, delete-orphan")
    library_shows = relationship("LibraryShow", back_populates="user", cascade="all, delete-orphan")
    scan_runs = relationship("ScanRun", back_populates="user", cascade="all, delete-orphan")


class MissingMovie(Base):
    __tablename__ = "missing_movies"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tmdb_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False)
    year = Column(Integer, nullable=True)
    collection_id = Column(Integer, nullable=False)
    collection_name = Column(String, default="")
    release_date = Column(String, nullable=True)
    status = Column(String, default="missing")   # missing | upcoming | streamable
    streaming_services = Column(Text, default="[]")  # JSON list
    poster_path = Column(String, nullable=True)
    last_checked = Column(DateTime(timezone=True), default=_now)
    availability_checked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="missing_movies")

    @property
    def streaming_list(self) -> list:
        return json.loads(self.streaming_services or "[]")


class MissingEpisode(Base):
    __tablename__ = "missing_episodes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    show_tmdb_id = Column(Integer, nullable=False, index=True)
    show_title = Column(String, nullable=False)
    season_number = Column(Integer, nullable=False)
    episode_number = Column(Integer, nullable=False)
    episode_title = Column(String, default="")
    air_date = Column(String, nullable=True)
    status = Column(String, default="missing")   # missing | upcoming | streamable
    streaming_services = Column(Text, default="[]")
    last_checked = Column(DateTime(timezone=True), default=_now)
    availability_checked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="missing_episodes")

    @property
    def streaming_list(self) -> list:
        return json.loads(self.streaming_services or "[]")


class MissingAudio(Base):
    __tablename__ = "missing_audio"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plex_key = Column(Integer, nullable=False)
    show_plex_key = Column(Integer, nullable=True, index=True)  # set for episodes
    title = Column(String, nullable=False)
    media_type = Column(String, default="movie")  # movie | episode
    missing_audio_langs = Column(Text, default="[]")
    missing_subtitle_langs = Column(Text, default="[]")
    last_checked = Column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="missing_audio")


class LibraryMovie(Base):
    __tablename__ = "library_movies"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tmdb_id = Column(Integer, nullable=False, index=True)
    plex_key = Column(Integer, nullable=True)         # None = not in Plex
    title = Column(String, nullable=False)
    year = Column(Integer, nullable=True)
    poster_path = Column(String, nullable=True)
    collection_id = Column(Integer, nullable=True)
    collection_name = Column(String, nullable=True)
    release_date = Column(String, nullable=True)
    status = Column(String, default="present")        # present | missing | upcoming | streamable
    streaming_services = Column(Text, default="[]")
    last_updated = Column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="library_movies")

    @property
    def streaming_list(self) -> list:
        return json.loads(self.streaming_services or "[]")


class LibraryShow(Base):
    __tablename__ = "library_shows"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tmdb_id = Column(Integer, nullable=False, index=True)
    plex_key = Column(Integer, nullable=True)
    title = Column(String, nullable=False)
    year = Column(Integer, nullable=True)
    poster_path = Column(String, nullable=True)
    episodes_total = Column(Integer, default=0)
    episodes_present = Column(Integer, default=0)
    missing_count = Column(Integer, default=0)
    status = Column(String, default="complete")       # complete | incomplete
    last_updated = Column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="library_shows")


class ScanRun(Base):
    __tablename__ = "scan_runs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scan_type = Column(String, nullable=False)   # full | availability | plex
    started_at = Column(DateTime(timezone=True), default=_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="running")   # running | completed | failed
    error = Column(Text, nullable=True)

    user = relationship("User", back_populates="scan_runs")


class TmdbProviderCache(Base):
    """Shared provider cache — one row per (tmdb_id, media_type), stores all regions."""
    __tablename__ = "tmdb_provider_cache"

    tmdb_id    = Column(Integer, primary_key=True)
    media_type = Column(String(10), primary_key=True)  # "movie" or "tv"
    data_json  = Column(Text, nullable=False, default="{}")  # {region: [{name, provider_id, ...}]}
    cached_at  = Column(DateTime(timezone=True), nullable=False, default=_now)


class TmdbResponseCache(Base):
    """Trimmed TMDb responses (movie, collection, show, season, id lookups), shared across users."""
    __tablename__ = "tmdb_response_cache"

    key       = Column(String, primary_key=True)  # e.g. "season:1399:2"
    data_json = Column(Text, nullable=False, default="{}")
    cached_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class NotificationSent(Base):
    __tablename__ = "notifications_sent"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_type = Column(String, nullable=False)   # movie | episode
    item_ref = Column(String, nullable=False)    # tmdb_id or "show_id:s:e"
    notification_type = Column(String, nullable=False)  # new_release | streamable | scan_done
    sent_at = Column(DateTime(timezone=True), default=_now)
