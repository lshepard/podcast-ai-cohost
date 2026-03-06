#!/usr/bin/env python3
"""
Export episode transcripts as markdown files.

This script connects to the podcast recording database and exports each episode
as a markdown file containing the full transcript organized by segments.
"""

import os
import sys
import re
import datetime
import argparse
from pathlib import Path

# Add app to sys.path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.core.config import settings
from backend.app.db.session import SessionLocal
from backend.app.db.models import Episode, Segment, Source

def sanitize_filename(text, max_length=100):
    """Convert text to a safe filename."""
    if not text:
        return "untitled"
    
    # Remove HTML tags if any
    text = re.sub(r'<[^>]+>', '', text)
    
    # Replace problematic characters with underscores
    sanitized = re.sub(r'[^\w\s-]', '', text.strip())
    
    # Replace spaces and multiple underscores with single underscores
    sanitized = re.sub(r'[-\s]+', '_', sanitized)
    
    # Remove leading/trailing underscores and limit length
    sanitized = sanitized.strip('_')[:max_length]
    
    return sanitized if sanitized else "untitled"

def format_segment_type(segment_type):
    """Format segment type for display."""
    if segment_type == 'human':
        return '🎙️ Host'
    elif segment_type == 'bot':
        return '🤖 AI (Emerald)'
    elif segment_type == 'source':
        return '📚 Source'
    else:
        return f'📝 {segment_type.title()}'

def export_episode_transcript(episode, output_dir):
    """Export a single episode as a markdown transcript."""
    
    # Create filename
    episode_prefix = f"{episode.id:02d}" if episode.id < 100 else str(episode.id)
    title_safe = sanitize_filename(episode.title or f"Episode {episode.id}")
    filename = f"{episode_prefix}_{title_safe}.md"
    output_path = output_dir / filename
    
    # Get segments ordered by order_index
    db = SessionLocal()
    try:
        segments = (db.query(Segment)
                   .filter(Segment.episode_id == episode.id)
                   .order_by(Segment.order_index)
                   .all())
        
        # Get sources for this episode
        sources = episode.sources
        
    finally:
        db.close()
    
    # Generate markdown content
    lines = []
    
    # Header
    lines.append(f"# {episode.title or f'Episode {episode.id}'}")
    lines.append("")
    
    if episode.description:
        lines.append("## Description")
        lines.append("")
        lines.append(episode.description)
        lines.append("")
    
    # Metadata
    lines.append("## Episode Information")
    lines.append("")
    lines.append(f"- **Episode ID:** {episode.id}")
    lines.append(f"- **Created:** {episode.created_at.strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"- **Last Updated:** {episode.updated_at.strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"- **Number of Segments:** {len(segments)}")
    lines.append("")
    
    # Sources
    if sources:
        lines.append("## Sources")
        lines.append("")
        for i, source in enumerate(sources, 1):
            lines.append(f"{i}. **{source.title}**")
            if source.url:
                lines.append(f"   - URL: {source.url}")
            if source.source_type:
                lines.append(f"   - Type: {source.source_type}")
            if source.summary:
                lines.append(f"   - Summary: {source.summary}")
            lines.append("")
    
    # Notes/Script
    if episode.notes:
        lines.append("## Notes and Script")
        lines.append("")
        lines.append(episode.notes)
        lines.append("")
    
    # Transcript
    lines.append("## Transcript")
    lines.append("")
    
    if not segments:
        lines.append("*No segments found for this episode.*")
    else:
        for i, segment in enumerate(segments, 1):
            # Segment header
            segment_type_display = format_segment_type(segment.segment_type)
            lines.append(f"### Segment {i}: {segment_type_display}")
            lines.append("")
            
            # Segment content
            if segment.text_content:
                # Clean up the text content
                text = segment.text_content.strip()
                # Convert \r\n to proper newlines
                text = text.replace('\\r\\n', '\n').replace('\\n', '\n')
                lines.append(text)
            else:
                lines.append("*[No text content for this segment]*")
            
            lines.append("")
            
            # Technical details (optional, can be commented out)
            tech_details = []
            if segment.audio_path:
                tech_details.append(f"Audio: `{segment.audio_path}`")
            if segment.video_path:
                tech_details.append(f"Video: `{segment.video_path}`")
            if segment.duration:
                duration_sec = segment.duration / 1000
                tech_details.append(f"Duration: {duration_sec:.1f}s")
            
            if tech_details:
                lines.append("*Technical details:*")
                for detail in tech_details:
                    lines.append(f"- {detail}")
                lines.append("")
    
    # Footer
    lines.append("---")
    lines.append("")
    lines.append(f"*Transcript exported on {datetime.datetime.now().strftime('%Y-%m-%d at %H:%M:%S')}*")
    
    # Write to file
    content = '\n'.join(lines)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return output_path, len(segments)

def main():
    parser = argparse.ArgumentParser(description='Export podcast episode transcripts as markdown files')
    parser.add_argument('--output-dir', '-o', 
                       default='./transcripts', 
                       help='Directory to save transcript files (default: ./transcripts)')
    parser.add_argument('--episode-id', '-e', 
                       type=int, 
                       help='Export only a specific episode ID')
    
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print(f"📝 Exporting episode transcripts to: {output_dir.absolute()}")
    print()
    
    # Connect to database
    db = SessionLocal()
    
    try:
        # Get episodes to export
        if args.episode_id:
            episodes = db.query(Episode).filter(Episode.id == args.episode_id).all()
            if not episodes:
                print(f"❌ No episode found with ID {args.episode_id}")
                return 1
        else:
            episodes = db.query(Episode).order_by(Episode.id).all()
        
        if not episodes:
            print("❌ No episodes found in database")
            return 1
        
        print(f"Found {len(episodes)} episode(s) to export:")
        print()
        
        # Export each episode
        total_segments = 0
        exported_files = []
        
        for episode in episodes:
            try:
                output_path, segment_count = export_episode_transcript(episode, output_dir)
                total_segments += segment_count
                exported_files.append(output_path)
                
                print(f"✅ Episode {episode.id}: {episode.title or 'Untitled'}")
                print(f"   📄 File: {output_path.name}")
                print(f"   🎯 Segments: {segment_count}")
                print()
                
            except Exception as e:
                print(f"❌ Error exporting episode {episode.id}: {e}")
                print()
        
        # Summary
        print("=" * 60)
        print(f"🎉 Export complete!")
        print(f"📁 Exported {len(exported_files)} episodes")
        print(f"🎯 Total segments: {total_segments}")
        print(f"📂 Output directory: {output_dir.absolute()}")
        print()
        print("Files created:")
        for file_path in exported_files:
            print(f"  - {file_path.name}")
            
    finally:
        db.close()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
