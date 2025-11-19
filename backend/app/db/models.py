from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class SegmentType(str, Enum):
    HUMAN = "human"
    BOT = "bot"
    SOURCE = "source"


class SourceType(str, Enum):
    PDF = "pdf"
    WEB = "web"
    TEXT = "text"


# Association table for Episode-Source many-to-many relationship
episode_sources = Table(
    "episode_sources",
    Base.metadata,
    Column("episode_id", Integer, ForeignKey("episodes.id", ondelete="CASCADE")),
    Column("source_id", Integer, ForeignKey("sources.id", ondelete="CASCADE")),
)


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True)
    source_type = Column(SQLEnum(SourceType))
    content = Column(Text, nullable=True)  # Processed text content
    summary = Column(Text, nullable=True)  # LLM-generated summary
    url = Column(String(512), nullable=True)  # For web sources
    file_path = Column(String(512), nullable=True)  # For PDF sources
    token_count = Column(Integer, nullable=True)  # Number of tokens in content
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    episodes = relationship("Episode", secondary=episode_sources, back_populates="sources")


class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)  # Additional context, script, and important info for the episode
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    segments = relationship("Segment", back_populates="episode", cascade="all, delete-orphan")
    sources = relationship("Source", secondary=episode_sources, back_populates="episodes")


class Segment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id", ondelete="CASCADE"))
    segment_type = Column(SQLEnum(SegmentType))
    order_index = Column(Integer, index=True)
    text_content = Column(Text, nullable=True)
    audio_path = Column(String(255), nullable=True)
    raw_audio_path = Column(String(255), nullable=True)
    video_path = Column(String(255), nullable=True)  # Path to video file
    raw_video_path = Column(String(255), nullable=True)  # Path to raw/original video file
    duration = Column(Integer, nullable=True)  # Duration in milliseconds
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    episode = relationship("Episode", back_populates="segments") 