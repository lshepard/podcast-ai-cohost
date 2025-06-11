import cv2
import mediapipe as mp
import numpy as np
from moviepy.video.io.VideoFileClip import VideoFileClip
from moviepy.audio.io.AudioFileClip import AudioFileClip
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import Segment
from app.core.config import settings


def remove_background_from_video(input_video_path: str, background_image_path: str, output_video_path: str) -> None:
    """
    Removes the background from a video using MediaPipe Selfie Segmentation and saves the composited video.
    Preserves the original audio track.
    Args:
        input_video_path: Path to the input video file.
        background_image_path: Path to the background image file.
        output_video_path: Path to save the output video with background removed.
    """
    # Load MediaPipe
    mp_selfie_segmentation = mp.solutions.selfie_segmentation
    segmenter = mp_selfie_segmentation.SelfieSegmentation(model_selection=1)

    # Load video and get properties
    cap = cv2.VideoCapture(input_video_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if width == 0 or height == 0:
        raise ValueError(f"Failed to get video dimensions for: {input_video_path}. Got width={width}, height={height}")

    # Load and check background image
    bg_image = cv2.imread(background_image_path)
    if bg_image is None:
        raise FileNotFoundError(f"Background image not found or could not be loaded: {background_image_path}")
    bg_image = cv2.resize(bg_image, (width, height))

    # Output video writer (temporary file for video only)
    temp_video_path = output_video_path + ".video_only.mp4"
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(temp_video_path, fourcc, fps, (width, height))

    # Process video frame-by-frame
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # Convert to RGB and segment
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = segmenter.process(rgb_frame)

        # Use soft mask for alpha blending
        alpha = results.segmentation_mask  # values between 0.0 and 1.0
        # Apply Gaussian blur to the alpha mask
        alpha = cv2.GaussianBlur(alpha, (21, 21), 0)
        foreground = frame.astype(np.float32) / 255.0
        background = bg_image.astype(np.float32) / 255.0
        alpha = np.expand_dims(alpha, axis=-1)
        composite = alpha * foreground + (1 - alpha) * background
        composite = (composite * 255).astype(np.uint8)

        # Write frame to output
        out.write(composite)

    cap.release()
    out.release()
    segmenter.close()

    # Use MoviePy to add the original audio back to the processed video
    video_clip = VideoFileClip(temp_video_path)
    original_clip = VideoFileClip(input_video_path)
    if original_clip.audio is not None:
        final_clip = video_clip.with_audio(original_clip.audio)
        final_clip.write_videofile(output_video_path, codec="libx264", audio_codec="aac")
        final_clip.close()
    else:
        # No audio, just rename the temp video
        os.rename(temp_video_path, output_video_path)
    video_clip.close()
    original_clip.close()
    # Clean up temp file if it still exists
    if os.path.exists(temp_video_path):
        os.remove(temp_video_path)

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def update_segment_video_path(episode_id, segment_id, video_path):
    session = SessionLocal()
    try:
        segment = session.query(Segment).filter(Segment.episode_id == episode_id, Segment.id == segment_id).first()
        if segment:
            segment.video_path = video_path
            session.commit()
    finally:
        session.close() 