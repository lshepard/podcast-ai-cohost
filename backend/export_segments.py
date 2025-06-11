import os
import sys
from pydub import AudioSegment
import re
import shutil
import datetime

# Add app to sys.path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'app', 'db'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'app', 'core'))

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.models import Segment

def sanitize_filename(text, max_length=16):
    # Remove non-alphanumeric characters, replace spaces with nothing, lowercase, and trim
    sanitized = re.sub(r'[^a-zA-Z0-9 ]', '', text or '')
    sanitized = sanitized.strip().replace(' ', '').lower()
    return sanitized[:max_length] if sanitized else 'segment'

def export_segments(episode_number):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'data')
    segments_dir = os.path.join(data_dir, 'episodes', str(episode_number), 'segments')
    # Create a unique timestamped export directory
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    export_dir = os.path.join(data_dir, 'episodes', str(episode_number), 'exports', f'export_{timestamp}')

    if not os.path.exists(segments_dir):
        print(f"Segments directory does not exist: {segments_dir}")
        return

    os.makedirs(export_dir, exist_ok=True)

    # Query the database for segments in order
    db = SessionLocal()
    segments = db.query(Segment).filter(Segment.episode_id == int(episode_number)).order_by(Segment.order_index).all()
    db.close()

    missing_files = []
    for idx, seg in enumerate(segments, 1):
        # Determine type
        seg_type = 'human' if getattr(seg, 'segment_type', '').lower() == 'human' else 'ai'
        # Get first words from transcript/text_content
        first_words = (seg.text_content or '').strip().split()
        first_words = ' '.join(first_words[:4])  # Use first 4 words
        sanitized = sanitize_filename(first_words)
        order_str = f"{idx:02d}"
        # Export audio
        rel_audio = seg.raw_audio_path or seg.audio_path
        if rel_audio:
            ext = os.path.splitext(rel_audio)[1] or '.mp3'
            out_name = f"{order_str}_{seg_type}_{sanitized}{ext}"
            src_path = os.path.join(data_dir, rel_audio.lstrip('/')) if not rel_audio.startswith('data/') else os.path.join(base_dir, rel_audio)
            if os.path.exists(src_path):
                shutil.copy2(src_path, os.path.join(export_dir, out_name))
                print(f"Exported audio: {out_name}")
            else:
                missing_files.append(f"Missing audio: {src_path}")
        # Export video
        rel_video = getattr(seg, 'video_path', None)
        if rel_video:
            ext = os.path.splitext(rel_video)[1] or '.mp4'
            out_name = f"{order_str}_{seg_type}_{sanitized}{ext}"
            src_path = os.path.join(data_dir, rel_video.lstrip('/')) if not rel_video.startswith('data/') else os.path.join(base_dir, rel_video)
            if os.path.exists(src_path):
                shutil.copy2(src_path, os.path.join(export_dir, out_name))
                print(f"Exported video: {out_name}")
            else:
                missing_files.append(f"Missing video: {src_path}")

    if missing_files:
        print("Some files were missing:")
        for m in missing_files:
            print(m)
    print(f"\nExport complete. Exported files are in: {export_dir}\n")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python export_segments.py <episode_number>")
        sys.exit(1)
    export_segments(sys.argv[1]) 