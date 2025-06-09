from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class SegmentType(str, Enum):
    HUMAN = "human"
    BOT = "bot"


class SourceType(str, Enum):
    PDF = "pdf"
    WEB = "web"
    TEXT = "text"


# Source schemas
class SourceBase(BaseModel):
    title: Optional[str] = None
    source_type: SourceType
    content: Optional[str] = None
    summary: Optional[str] = None
    url: Optional[str] = None
    file_path: Optional[str] = None
    token_count: Optional[int] = None


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    url: Optional[str] = None
    file_path: Optional[str] = None
    token_count: Optional[int] = None


class Source(SourceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Episode schemas
class EpisodeBase(BaseModel):
    title: str
    description: Optional[str] = None
    notes: Optional[str] = None


class EpisodeCreate(EpisodeBase):
    pass


class EpisodeUpdate(EpisodeBase):
    title: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None


class Episode(EpisodeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    sources: List[Source] = []

    class Config:
        from_attributes = True


# Segment schemas
class SegmentBase(BaseModel):
    segment_type: SegmentType
    order_index: int
    text_content: Optional[str] = None


class SegmentCreate(SegmentBase):
    episode_id: int


class SegmentUpdate(BaseModel):
    text_content: Optional[str] = None
    order_index: Optional[int] = None
    audio_path: Optional[str] = None


class Segment(SegmentBase):
    id: int
    episode_id: int
    audio_path: Optional[str] = None
    raw_audio_path: Optional[str] = None
    video_path: Optional[str] = None
    duration: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EpisodeWithSegments(Episode):
    segments: List[Segment] = []


# Audio processing schemas
class TranscribeRequest(BaseModel):
    file_path: str = Field(..., description="Path to the audio file to transcribe")


class TranscribeResponse(BaseModel):
    success: bool
    message: str
    transcription: Optional[str] = None


class GenerateSpeechRequest(BaseModel):
    text: str = Field(..., description="Text content to convert to speech")
    episode_id: int = Field(..., description="ID of the episode")
    segment_id: int = Field(..., description="ID of the segment")


class GenerateSpeechResponse(BaseModel):
    success: bool
    message: str
    file_path: Optional[str] = None


# LLM generation schemas
class GenerateTextRequest(BaseModel):
    prompt: str = Field(..., description="Prompt for text generation")
    episode_id: int = Field(..., description="Episode ID for context")
    order_index: int = Field(..., description="Order index of the current segment")
    history: Optional[list] = Field(default=[], description="Previous conversation history")


class GenerateTextResponse(BaseModel):
    success: bool
    message: str
    text: Optional[str] = None 