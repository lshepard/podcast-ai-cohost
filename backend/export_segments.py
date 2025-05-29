import os
import sys
from pydub import AudioSegment

# Add app to sys.path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'app', 'db'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'app', 'core'))

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.models import Segment

def export_segments(episode_number):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'data')
    segments_dir = os.path.join(data_dir, 'episodes', str(episode_number), 'segments')
    export_dir = os.path.join(data_dir, 'episodes', str(episode_number), 'export')

    if not os.path.exists(segments_dir):
        print(f"Segments directory does not exist: {segments_dir}")
        return

    os.makedirs(export_dir, exist_ok=True)

    # Query the database for segments in order
    db = SessionLocal()
    segments = db.query(Segment).filter(Segment.episode_id == int(episode_number)).order_by(Segment.order_index).all()
    db.close()

    audio_files = []
    missing_files = []
    for seg in segments:
        rel_path = seg.raw_audio_path or seg.audio_path
        if not rel_path:
            missing_files.append(f"Segment {seg.id} (order_index {seg.order_index}) has no audio path.")
            continue
        rel_path = rel_path.lstrip('/')
        # If 'data/' is not in the path, prepend it
        if not rel_path.startswith('data/'):
            abs_path = os.path.join(data_dir, rel_path)
        else:
            abs_path = os.path.join(base_dir, rel_path)
        if os.path.exists(abs_path) and abs_path.lower().endswith((".mp3", ".wav", ".m4a")):
            audio_files.append(abs_path)
        else:
            missing_files.append(f"Segment {seg.id} (order_index {seg.order_index}) missing or invalid file: {abs_path}")

    if missing_files:
        raise FileNotFoundError("\n".join(missing_files))

    if not audio_files:
        print("No valid audio files found for this episode.")
        return

    combined = None
    for filename in audio_files:
        audio = AudioSegment.from_file(filename)
        if combined is None:
            combined = audio
        else:
            combined += audio
        print(f"Added {filename} to combined audio")

    output_path = os.path.join(export_dir, f"episode_{episode_number}_combined.mp3")
    combined.export(output_path, format="mp3")
    print(f"Exported combined audio to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python export_segments.py <episode_number>")
        sys.exit(1)
    export_segments(sys.argv[1]) 