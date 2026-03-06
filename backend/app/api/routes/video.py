import json
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
from app.lib.audio import generate_speech, transcribe_audio
from app.lib.animate import hedra_redis_key
from app.celery_app import remove_background_task

from app.celery_app import submit_hedra_video_task, redis_client

router = APIRouter()


def get_video_path(episode_id: int, segment_id: int, extension: str, prefix: str, unique_id: str, suffix: str = None) -> str:
    """Create a path for a video file with a unique identifier."""
    # Create episode directory if it doesn't exist
    episode_dir = os.path.join(settings.EPISODES_DIR, str(episode_id))
    segments_dir = os.path.join(episode_dir, "segments")
    os.makedirs(segments_dir, exist_ok=True)

    # Add a random nonce to the filename to prevent caching
    video_path = os.path.join(segments_dir, f"{segment_id}_{prefix}_{unique_id}.{extension}")
    return video_path


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

    extension = os.path.splitext(file.filename)[1] or "webm"
    unique_id = str(uuid.uuid4())[:8]

    video_path = get_video_path(episode_id, segment_id, extension, "video", unique_id, "raw")
    db_segment.raw_video_path = video_path
    db.commit()

    # Save the uploaded file to disk
    with open(video_path, "wb") as out_file:
        content = await file.read()
        out_file.write(content)

    mp4_video_path = get_video_path(episode_id, segment_id, "mp4", "video", unique_id, "raw")
    bg_removed_video_path = get_video_path(episode_id, segment_id, "mp4", "video", unique_id, "bgremoved")

    # Convert to mp4 (realtime)
    cmd = [
        'ffmpeg',
        '-i', video_path,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        mp4_video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"ffmpeg conversion failed: {result.stderr}")

    # Transcribe (realtime)
    success, message, transcription = transcribe_audio(mp4_video_path)
    if success and transcription:
        db_segment.text_content = transcription
        db.commit()
    else:
        # Log error but continue
        print(f"[ERROR] Transcription failed: {message}")

    # Only background removal is Celery
    background_image_path = "backgrounds/background.png"
    remove_background_task.apply_async((mp4_video_path, background_image_path, bg_removed_video_path, episode_id, segment_id))

    return {
        "success": True,
        "message": "Raw video uploaded, converted, and transcribed. Background removal will continue in background.",
        "raw_video_path": video_path,
        "mp4_video_path": mp4_video_path,
        "transcription": transcription if success else None,
    }



@router.post("/video/animate", status_code=202)
def animate_segment(
    episode_id: int,
    segment_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    db_segment = db.query(models.Segment).filter(models.Segment.episode_id == episode_id, models.Segment.id == segment_id).first()
    if db_segment is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    if not db_segment.audio_path:
        raise HTTPException(status_code=400, detail="Segment has no audio to animate")
    audio_path = db_segment.audio_path.replace("/episodes", str(settings.EPISODES_DIR))
    unique_id = str(uuid.uuid4())[:8]
    output_filename = get_video_path(episode_id, segment_id, "mp4", "animated", unique_id, "hedra")
    # Enqueue the new submission celery task
    submit_hedra_video_task.delay(episode_id, segment_id, audio_path, output_filename)
    return {"message": "Animation started"}


@router.get("/video/animation_status")
def get_animation_status(
    episode_id: int,
    segment_id: int
):
    """Check the status of a current video animation."""
    redis_key = hedra_redis_key(episode_id, segment_id)
    job_info = redis_client.get(redis_key)
    if not job_info:
        return {"status": "not_started"}
    job_info = json.loads(job_info)
    return {"status": job_info.get("status", "unknown"), "error": job_info.get("error")} 