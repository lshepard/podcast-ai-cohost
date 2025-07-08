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

def get_audio_path(rel_audio, base_dir, data_dir):
    """Helper function to resolve audio file paths"""
    if rel_audio.startswith('/episodes/'):
        # Remove the /episodes/ prefix and use settings.EPISODES_DIR
        relative_path = rel_audio[10:]  # Remove '/episodes/'
        src_path = os.path.join(str(settings.EPISODES_DIR), relative_path)
    elif rel_audio.startswith('data/'):
        # Handle data/ prefixed paths
        src_path = os.path.join(base_dir, rel_audio)
    else:
        # Handle other relative paths
        src_path = os.path.join(data_dir, rel_audio.lstrip('/'))
    return src_path

def export_segments(episode_number):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'data')
    segments_dir = os.path.join(data_dir, 'episodes', str(episode_number), 'segments')
    # Create a unique timestamped export directory
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    export_dir = os.path.join(data_dir, 'episodes', str(episode_number), 'exports', f'export_{timestamp}')

    # Debug output
    print(f"DEBUG: settings.EPISODES_DIR = {settings.EPISODES_DIR}")
    print(f"DEBUG: base_dir = {base_dir}")
    print(f"DEBUG: data_dir = {data_dir}")

    if not os.path.exists(segments_dir):
        print(f"Segments directory does not exist: {segments_dir}")
        return

    os.makedirs(export_dir, exist_ok=True)

    # Query the database for segments in order
    db = SessionLocal()
    segments = db.query(Segment).filter(Segment.episode_id == int(episode_number)).order_by(Segment.order_index).all()
    db.close()

    missing_files = []
    audio_segments = []  # Store audio segments for combining
    
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
            src_path = get_audio_path(rel_audio, base_dir, data_dir)
            print(f"DEBUG: rel_audio = {rel_audio}, src_path = {src_path}")
            
            if os.path.exists(src_path):
                shutil.copy2(src_path, os.path.join(export_dir, out_name))
                print(f"Exported audio: {out_name}")
                # Add to audio segments for combining
                try:
                    audio_segment = AudioSegment.from_file(src_path)
                    audio_segments.append(audio_segment)
                    print(f"Added to combined audio: {src_path}")
                except Exception as e:
                    print(f"Warning: Could not load audio segment {src_path}: {e}")
            else:
                missing_files.append(f"Missing audio: {src_path}")
        # Export video
        rel_video = getattr(seg, 'video_path', None)
        if rel_video:
            ext = os.path.splitext(rel_video)[1] or '.mp4'
            out_name = f"{order_str}_{seg_type}_{sanitized}{ext}"
            # Use settings.EPISODES_DIR to construct the correct path
            if rel_video.startswith('/episodes/'):
                # Remove the /episodes/ prefix and use settings.EPISODES_DIR
                relative_path = rel_video[10:]  # Remove '/episodes/'
                src_path = os.path.join(str(settings.EPISODES_DIR), relative_path)
            elif rel_video.startswith('data/'):
                # Handle data/ prefixed paths
                src_path = os.path.join(base_dir, rel_video)
            else:
                # Handle other relative paths
                src_path = os.path.join(data_dir, rel_video.lstrip('/'))
            
            if os.path.exists(src_path):
                shutil.copy2(src_path, os.path.join(export_dir, out_name))
                print(f"Exported video: {out_name}")
            else:
                missing_files.append(f"Missing video: {src_path}")

    # Create combined MP3 file
    if audio_segments:
        print(f"\nCreating combined MP3 file from {len(audio_segments)} segments...")
        try:
            # Concatenate all audio segments
            combined_audio = audio_segments[0]
            for segment in audio_segments[1:]:
                combined_audio += segment
            
            # Export the combined audio
            combined_filename = f"episode_{episode_number}_combined_{timestamp}.mp3"
            combined_path = os.path.join(export_dir, combined_filename)
            combined_audio.export(combined_path, format="mp3")
            print(f"Successfully created combined MP3: {combined_filename}")
            print(f"Combined audio duration: {len(combined_audio) / 1000:.2f} seconds")
        except Exception as e:
            print(f"Error creating combined MP3: {e}")
    else:
        print("No audio segments found to combine")

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