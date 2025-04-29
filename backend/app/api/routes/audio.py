import os
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import get_current_user
from app.core.config import settings
from app.db import models
from app.db.session import get_db
from app.lib.audio import generate_speech, transcribe_audio

router = APIRouter()


@router.post("/audio/transcribe", response_model=schemas.TranscribeResponse)
async def transcribe_audio_file(
    request: schemas.TranscribeRequest,
    _: str = Depends(get_current_user),
):
    """Transcribe an audio file using AssemblyAI."""
    success, message, transcription = transcribe_audio(request.file_path)
    return {
        "success": success,
        "message": message,
        "transcription": transcription,
    }


@router.post("/audio/synthesize", response_model=schemas.GenerateSpeechResponse)
async def synthesize_speech(
    request: schemas.GenerateSpeechRequest,
    _: str = Depends(get_current_user),
):
    """Generate speech from text using ElevenLabs."""
    success, message, file_path = generate_speech(request.text, request.output_path)
    return {
        "success": success,
        "message": message,
        "file_path": file_path,
    }


@router.post("/audio/upload", status_code=status.HTTP_201_CREATED)
async def upload_audio(
    episode_id: int,
    segment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Upload an audio file for a segment."""
    # Check if segment exists
    db_segment = (
        db.query(models.Segment)
        .filter(models.Segment.episode_id == episode_id, models.Segment.id == segment_id)
        .first()
    )
    if db_segment is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Create episode directory if it doesn't exist
    episode_dir = os.path.join(settings.EPISODES_DIR, str(episode_id))
    segments_dir = os.path.join(episode_dir, "segments")
    os.makedirs(segments_dir, exist_ok=True)
    
    # Save the uploaded file
    file_path = os.path.join(segments_dir, f"{segment_id}_raw.wav")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Update segment with the file path
    db_segment.raw_audio_path = file_path
    db.commit()
    
    # Transcribe the audio if it's a human segment
    if db_segment.segment_type == models.SegmentType.HUMAN:
        success, message, transcription = transcribe_audio(file_path)
        if success and transcription:
            db_segment.text_content = transcription
            db.commit()
    
    return {"success": True, "message": "Audio uploaded successfully", "file_path": file_path} 