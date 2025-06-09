import os
import uuid
import logging
from typing import List
import subprocess
from moviepy import VideoFileClip
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import get_current_user
from app.core.config import settings
from app.db import models
from app.db.session import get_db
from app.lib.audio import generate_speech, transcribe_audio, check_elevenlabs_key

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
    
    # Save the uploaded file with its original extension
    orig_ext = os.path.splitext(file.filename)[1] or ".wav"
    file_path = os.path.join(segments_dir, f"{segment_id}_raw{orig_ext}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Update segment with the file paths
    db_segment.raw_audio_path = file_path
    
    # Also set the audio_path to be the same as raw_audio_path for human segments
    # This ensures the audio can be played back in the UI
    relative_path = f"/episodes/{episode_id}/segments/{segment_id}_raw{orig_ext}"
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
    """Upload a video file for a segment."""
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
    
    try:
        # Save the uploaded video file with its original extension
        orig_ext = os.path.splitext(file.filename)[1] or ".webm"
        video_path = os.path.join(segments_dir, f"{segment_id}_video{orig_ext}")
        print(f"[DEBUG] Saving uploaded video to: {video_path}")
        with open(video_path, "wb") as buffer:
            content = await file.read()
            print(f"[DEBUG] Uploaded file size: {len(content)} bytes")
            buffer.write(content)
        print(f"[DEBUG] File written: {os.path.exists(video_path)}")
        
        # Convert WebM to MP4 if needed
        if orig_ext.lower() == '.webm':
            mp4_path = os.path.join(segments_dir, f"{segment_id}_video.mp4")
            print(f"[DEBUG] Converting WebM to MP4: {mp4_path}")
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-c:v', 'libx264',  # Use H.264 codec
                '-preset', 'fast',  # Faster encoding
                '-crf', '23',       # Good quality
                '-c:a', 'aac',      # Convert audio to AAC
                '-b:a', '128k',     # Audio bitrate
                mp4_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"[ERROR] ffmpeg conversion failed: {result.stderr}")
                raise Exception("Failed to convert video format")
            
            # Use the MP4 file for duration and storage
            video_path = mp4_path
            relative_video_path = f"/episodes/{episode_id}/segments/{segment_id}_video.mp4"
        else:
            relative_video_path = f"/episodes/{episode_id}/segments/{segment_id}_video{orig_ext}"
        
        # Update segment with the video path
        db_segment.video_path = relative_video_path
        
        # Get video duration using moviepy
        print(f"[DEBUG] Getting video duration for {video_path}")
        video = VideoFileClip(video_path)
        duration = int(video.duration * 1000)  # Convert to milliseconds
        video.close()
        db_segment.duration = duration

        # Transcribe the video if it's a human segment
        transcription_result = None
        if db_segment.segment_type == models.SegmentType.HUMAN:
            success, message, transcription = transcribe_audio(video_path)
            transcription_result = {"success": success, "message": message}
            if success and transcription:
                db_segment.text_content = transcription
                db.commit()

        db.commit()
        
        return {
            "success": True,
            "message": "Video uploaded successfully",
            "video_path": relative_video_path,
            "duration": duration,
            "transcription": transcription_result
        }
        
    except Exception as e:
        print(f"[ERROR] Exception during video upload: {e}")
        # Clean up files if processing fails
        if os.path.exists(video_path):
            print(f"[DEBUG] Removing file due to error: {video_path}")
            os.remove(video_path)
        if 'mp4_path' in locals() and os.path.exists(mp4_path):
            print(f"[DEBUG] Removing converted file due to error: {mp4_path}")
            os.remove(mp4_path)
        raise HTTPException(status_code=500, detail=f"Error processing video: {str(e)}") 