import os
import uuid
import logging
from typing import List
import subprocess
from moviepy import VideoFileClip
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from celery import chord, group

from app.api import schemas
from app.api.deps import get_current_user
from app.core.config import settings
from app.db import models
from app.db.session import get_db
from app.lib.audio import generate_speech, transcribe_audio, check_elevenlabs_key
from app.celery_app import remove_background_task, convert_video_to_mp4_task, transcribe_video_task

router = APIRouter()



@router.post("/audio/synthesize", response_model=schemas.GenerateSpeechResponse)
async def synthesize_speech(
    request: schemas.GenerateSpeechRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Generate speech from text using ElevenLabs."""
    
    # Check if segment exists
    db_segment = (
        db.query(models.Segment)
        .filter(models.Segment.episode_id == request.episode_id, models.Segment.id == request.segment_id)
        .first()
    )
    if db_segment is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Generate a unique filename with a random component
    unique_id = str(uuid.uuid4())[:8]  # Use first 8 chars of UUID for brevity
    output_path = f"/episodes/{request.episode_id}/segments/{request.segment_id}_{unique_id}.mp3"
    
    # Generate the speech
    success, message, file_path = generate_speech(request.text, output_path)
    
    if success and file_path:
        # Update the segment with the audio path
        db_segment.audio_path = output_path
        db.commit()
    else:
        # Log error message for troubleshooting
        logger = logging.getLogger(__name__)
        logger.error(f"Speech generation failed: {message}")
    
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
    
    # Add a random nonce to the filename to prevent caching
    unique_id = str(uuid.uuid4())[:8]
    orig_ext = os.path.splitext(file.filename)[1] or ".wav"
    file_path = os.path.join(segments_dir, f"{segment_id}_raw_{unique_id}{orig_ext}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Update segment with the file paths
    db_segment.raw_audio_path = file_path
    
    # Also set the audio_path to be the same as raw_audio_path for human segments
    # This ensures the audio can be played back in the UI
    relative_path = f"/episodes/{episode_id}/segments/{segment_id}_raw_{unique_id}{orig_ext}"
    db_segment.audio_path = relative_path
    
    db.commit()
    
    # Transcribe the audio if it's a human segment
    if db_segment.segment_type == models.SegmentType.HUMAN:
        success, message, transcription = transcribe_audio(file_path)
        if success and transcription:
            db_segment.text_content = transcription
            db.commit()
    
    return {"success": True, "message": "Audio uploaded successfully", "file_path": file_path}


@router.get("/audio/test-elevenlabs")
async def test_elevenlabs(
    _: str = Depends(get_current_user),
):
    """Test ElevenLabs API connection and voice availability."""
    
    # Check API key validity
    key_valid, key_message = check_elevenlabs_key()
    
    # Specific voice ID test
    specific_voice_id = "jHVm0BlYCoqPpa5khLNP"  # Sarah montana voice ID
    
    # Test a short text-to-speech conversion
    test_text = "This is a test of the ElevenLabs integration."
    test_output_path = f"/episodes/test/elevenlabs_test_{uuid.uuid4()}.mp3"
    
    tts_success, tts_message, tts_path = generate_speech(test_text, test_output_path)
    
    return {
        "api_key_valid": key_valid,
        "api_key_message": key_message,
        "speech_generation_success": tts_success,
        "speech_generation_message": tts_message,
        "test_file_path": tts_path
    }


@router.post("/video/upload", status_code=status.HTTP_201_CREATED)
async def upload_video(
    episode_id: int,
    segment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Upload a video file for a segment. Only save the raw video and update raw_video_path. All post-processing is handled by Celery tasks."""
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

    # Add a random nonce to the filename to prevent caching
    unique_id = str(uuid.uuid4())[:8]
    orig_ext = os.path.splitext(file.filename)[1] or ".webm"
    video_path = os.path.join(segments_dir, f"{segment_id}_video_{unique_id}{orig_ext}")
    with open(video_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # Save the original video path to raw_video_path
    db_segment.raw_video_path = video_path
    db.commit()

    # Kick off Celery post-processing tasks (convert, remove background, transcribe) using a chord
    output_mp4_path = os.path.join(segments_dir, f"{segment_id}_video_{unique_id}.mp4")
    background_image_path = "background.png"
    output_bg_path = output_mp4_path.replace('.mp4', '_bgremoved.mp4')

    post_tasks = group(
        remove_background_task.s(output_mp4_path, background_image_path, output_bg_path, episode_id, segment_id),
        transcribe_video_task.s(output_mp4_path, episode_id, segment_id)
    )
    chord(convert_video_to_mp4_task.s(video_path, output_mp4_path, episode_id, segment_id), post_tasks).apply_async()

    return {
        "success": True,
        "message": "Raw video uploaded. Processing will continue in background.",
        "raw_video_path": video_path,
    } 