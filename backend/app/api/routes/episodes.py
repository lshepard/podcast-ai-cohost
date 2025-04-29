from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import get_current_user
from app.db import models
from app.db.session import get_db

router = APIRouter()


@router.get("/episodes", response_model=List[schemas.Episode])
def get_episodes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Get list of episodes."""
    episodes = db.query(models.Episode).offset(skip).limit(limit).all()
    return episodes


@router.post("/episodes", response_model=schemas.Episode, status_code=status.HTTP_201_CREATED)
def create_episode(
    episode: schemas.EpisodeCreate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Create a new episode."""
    db_episode = models.Episode(
        title=episode.title,
        description=episode.description,
    )
    db.add(db_episode)
    db.commit()
    db.refresh(db_episode)
    return db_episode


@router.get("/episodes/{episode_id}", response_model=schemas.EpisodeWithSegments)
def get_episode(
    episode_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Get a specific episode with its segments."""
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    return db_episode


@router.put("/episodes/{episode_id}", response_model=schemas.Episode)
def update_episode(
    episode_id: int,
    episode: schemas.EpisodeUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Update an episode."""
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    # Update fields if they are provided
    if episode.title is not None:
        db_episode.title = episode.title
    if episode.description is not None:
        db_episode.description = episode.description
    
    db.commit()
    db.refresh(db_episode)
    return db_episode


@router.delete("/episodes/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_episode(
    episode_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Delete an episode."""
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    db.delete(db_episode)
    db.commit()
    return None 