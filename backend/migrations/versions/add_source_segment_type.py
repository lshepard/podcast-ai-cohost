"""add source segment type

Revision ID: add_source_segment_type
Revises: add_raw_video_path_to_segments
Create Date: 2025-01-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_source_segment_type'
down_revision: Union[str, None] = 'add_raw_video_path_to_segments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to add 'source' segment type."""
    # For SQLite, we need to recreate the table to update the enum constraint
    # SQLite doesn't support ALTER COLUMN for enum types
    conn = op.get_bind()
    
    # Check if we're using SQLite
    if conn.dialect.name == 'sqlite':
        # SQLite: recreate table with new enum values
        # Create new table with updated enum constraint
        op.create_table(
            'segments_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('episode_id', sa.Integer(), nullable=True),
            sa.Column('segment_type', sa.Enum('human', 'bot', 'source', name='segmenttype'), nullable=True),
            sa.Column('order_index', sa.Integer(), nullable=True),
            sa.Column('text_content', sa.Text(), nullable=True),
            sa.Column('audio_path', sa.String(length=255), nullable=True),
            sa.Column('raw_audio_path', sa.String(length=255), nullable=True),
            sa.Column('video_path', sa.String(length=255), nullable=True),
            sa.Column('raw_video_path', sa.String(length=255), nullable=True),
            sa.Column('duration', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_segments_new_id'), 'segments_new', ['id'], unique=False)
        op.create_index(op.f('ix_segments_new_order_index'), 'segments_new', ['order_index'], unique=False)
        
        # Copy data from old table to new table
        op.execute('''
            INSERT INTO segments_new 
            (id, episode_id, segment_type, order_index, text_content, audio_path, 
             raw_audio_path, video_path, raw_video_path, duration, created_at)
            SELECT 
            id, episode_id, segment_type, order_index, text_content, audio_path,
            raw_audio_path, video_path, raw_video_path, duration, created_at
            FROM segments
        ''')
        
        # Drop old table
        op.drop_table('segments')
        
        # Rename new table
        op.rename_table('segments_new', 'segments')
    else:
        # For PostgreSQL and other databases with native enum support
        # Add the new enum value
        op.execute("ALTER TYPE segmenttype ADD VALUE IF NOT EXISTS 'source'")


def downgrade() -> None:
    """Downgrade schema to remove 'source' segment type."""
    conn = op.get_bind()
    
    if conn.dialect.name == 'sqlite':
        # SQLite: recreate table without 'source' enum value
        # First, delete any segments with 'source' type
        op.execute("DELETE FROM segments WHERE segment_type = 'source'")
        
        # Recreate table with old enum constraint
        op.create_table(
            'segments_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('episode_id', sa.Integer(), nullable=True),
            sa.Column('segment_type', sa.Enum('human', 'bot', name='segmenttype'), nullable=True),
            sa.Column('order_index', sa.Integer(), nullable=True),
            sa.Column('text_content', sa.Text(), nullable=True),
            sa.Column('audio_path', sa.String(length=255), nullable=True),
            sa.Column('raw_audio_path', sa.String(length=255), nullable=True),
            sa.Column('video_path', sa.String(length=255), nullable=True),
            sa.Column('raw_video_path', sa.String(length=255), nullable=True),
            sa.Column('duration', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_segments_new_id'), 'segments_new', ['id'], unique=False)
        op.create_index(op.f('ix_segments_new_order_index'), 'segments_new', ['order_index'], unique=False)
        
        # Copy data (excluding source segments which were already deleted)
        op.execute('''
            INSERT INTO segments_new 
            (id, episode_id, segment_type, order_index, text_content, audio_path,
             raw_audio_path, video_path, raw_video_path, duration, created_at)
            SELECT 
            id, episode_id, segment_type, order_index, text_content, audio_path,
            raw_audio_path, video_path, raw_video_path, duration, created_at
            FROM segments
        ''')
        
        # Drop old table
        op.drop_table('segments')
        
        # Rename new table
        op.rename_table('segments_new', 'segments')
    else:
        # For PostgreSQL: cannot easily remove enum values, so we'll just leave it
        # The application code will handle filtering out 'source' if needed
        pass

