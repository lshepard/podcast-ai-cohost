from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class SegmentType(str, Enum):
    HUMAN = "human"
    BOT = "bot"


# Episode schemas
class EpisodeBase(BaseModel):
    title: str
    description: Optional[str] = None


class EpisodeCreate(EpisodeBase):
    pass


class EpisodeUpdate(EpisodeBase):
    title: Optional[str] = None


class Episode(EpisodeBase):
    id: int
    created_at: datetime
    updated_at: datetime

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
    text: str = Field(..., description="Text to convert to speech")
    output_path: str = Field(..., description="Path to save the generated audio")


class GenerateSpeechResponse(BaseModel):
    success: bool
    message: str


# LLM generation schemas
class GenerateTextRequest(BaseModel):
    prompt: str = Field(..., description="Prompt for text generation")
    episode_id: int = Field(..., description="Episode ID for context")
    history: Optional[list] = Field(default=[], description="Previous conversation history")


class GenerateTextResponse(BaseModel):
    success: bool
    message: str
    text: Optional[str] = None 