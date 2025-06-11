import os
from celery import Celery
from app.lib.video import remove_background_from_video, update_segment_video_path
from app.lib.audio import transcribe_audio, update_segment_text_content
import subprocess

celery = Celery(
    "podcast_tasks",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
)

@celery.task
def convert_video_to_mp4_task(input_path, output_path, episode_id, segment_id):
    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"[DEBUG] ffmpeg conversion successful: {output_path}")
    else:
        print(f"[ERROR] ffmpeg conversion failed: {result.stderr}")
        raise Exception(f"ffmpeg conversion failed: {result.stderr}")

@celery.task
def transcribe_video_task(result, video_path, episode_id, segment_id):
    success, message, transcription = transcribe_audio(video_path)
    if success and transcription:
        update_segment_text_content(episode_id, segment_id, transcription)
    else:
        print(f"[ERROR] Transcription failed: {message}")

@celery.task
def remove_background_task(result, input_video_path, background_image_path, output_video_path, episode_id, segment_id):
    try:
        remove_background_from_video(input_video_path, background_image_path, output_video_path)
        # Update the video_path in the DB only if successful
        rel_path = output_video_path[output_video_path.find('/episodes/'):] if '/episodes/' in output_video_path else output_video_path
        update_segment_video_path(episode_id, segment_id, rel_path)
    except Exception as e:
        print(f"[ERROR] Background removal failed: {e}") 