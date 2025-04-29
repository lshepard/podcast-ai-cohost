from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import get_current_user
from app.db import models
from app.db.session import get_db

router = APIRouter()


@router.get("/episodes/{episode_id}/segments", response_model=List[schemas.Segment])
def get_segments(
    episode_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Get list of segments for an episode."""
    # Check if episode exists
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    segments = (
        db.query(models.Segment)
        .filter(models.Segment.episode_id == episode_id)
        .order_by(models.Segment.order_index)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return segments


@router.post("/episodes/{episode_id}/segments", response_model=schemas.Segment, status_code=status.HTTP_201_CREATED)
def create_segment(
    episode_id: int,
    segment: schemas.SegmentBase,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Create a new segment for an episode."""
    # Check if episode exists
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    # Create new segment
    db_segment = models.Segment(
        episode_id=episode_id,
        segment_type=segment.segment_type,
        order_index=segment.order_index,
        text_content=segment.text_content,
    )
    db.add(db_segment)
    db.commit()
    db.refresh(db_segment)
    return db_segment


@router.get("/episodes/{episode_id}/segments/{segment_id}", response_model=schemas.Segment)
def get_segment(
    episode_id: int,
    segment_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Get a specific segment."""
    db_segment = (
        db.query(models.Segment)
        .filter(models.Segment.episode_id == episode_id, models.Segment.id == segment_id)
        .first()
    )
    if db_segment is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    return db_segment


@router.put("/episodes/{episode_id}/segments/{segment_id}", response_model=schemas.Segment)
def update_segment(
    episode_id: int,
    segment_id: int,
    segment: schemas.SegmentUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Update a segment."""
    db_segment = (
        db.query(models.Segment)
        .filter(models.Segment.episode_id == episode_id, models.Segment.id == segment_id)
        .first()
    )
    if db_segment is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Update fields if they are provided
    if segment.text_content is not None:
        db_segment.text_content = segment.text_content
    if segment.order_index is not None:
        db_segment.order_index = segment.order_index
    
    db.commit()
    db.refresh(db_segment)
    return db_segment


@router.delete("/episodes/{episode_id}/segments/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_segment(
    episode_id: int,
    segment_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Delete a segment."""
    db_segment = (
        db.query(models.Segment)
        .filter(models.Segment.episode_id == episode_id, models.Segment.id == segment_id)
        .first()
    )
    if db_segment is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    db.delete(db_segment)
    db.commit()
    return None 