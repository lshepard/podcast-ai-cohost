"""add raw_video_path to segments

Revision ID: add_raw_video_path_to_segments
Revises: cd137dd563a7
Create Date: 2024-06-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_raw_video_path_to_segments'
down_revision: Union[str, None] = 'cd137dd563a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('segments', sa.Column('raw_video_path', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('segments', 'raw_video_path') 