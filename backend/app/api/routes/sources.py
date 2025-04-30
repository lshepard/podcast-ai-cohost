from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import get_current_user
from app.db import models
from app.db.session import get_db
from app.lib.web import process_web_source

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sources", response_model=schemas.Source)
async def create_source(
    source: schemas.SourceCreate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Create a new source."""
    try:
        # Validate source type
        if source.source_type not in [models.SourceType.WEB, models.SourceType.PDF, models.SourceType.TEXT]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid source type. Must be one of: {', '.join([t.value for t in models.SourceType])}"
            )

        # Process web sources
        if source.source_type == models.SourceType.WEB and source.url:
            result = process_web_source(source.url)
            if not result['success']:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result.get('error', 'Failed to process web source')
                )
            
            # Update source with scraped content and summary
            source.content = result['content']
            source.summary = result['summary']
            
            # If no title provided, use the URL as the title
            if not source.title:
                source.title = source.url
        
        # Create the source
        db_source = models.Source(**source.model_dump())
        db.add(db_source)
        db.commit()
        db.refresh(db_source)
        return db_source

    except HTTPException as he:
        # Re-raise HTTP exceptions as they are already properly formatted
        raise he
    except Exception as e:
        # Log the full exception details
        logger.error(f"Error creating source: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating source: {str(e)}"
        )


@router.get("/sources", response_model=List[schemas.Source])
async def list_sources(
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """List all sources."""
    return db.query(models.Source).all()


@router.get("/sources/{source_id}", response_model=schemas.Source)
async def get_source(
    source_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Get a specific source by ID."""
    db_source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return db_source


@router.put("/sources/{source_id}", response_model=schemas.Source)
async def update_source(
    source_id: int,
    source: schemas.SourceUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Update a source."""
    db_source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    
    for field, value in source.model_dump(exclude_unset=True).items():
        setattr(db_source, field, value)
    
    db.commit()
    db.refresh(db_source)
    return db_source


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Delete a source."""
    db_source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    
    db.delete(db_source)
    db.commit()


@router.post("/episodes/{episode_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_source_to_episode(
    episode_id: int,
    source_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Add a source to an episode."""
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    db_source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    
    if db_source not in db_episode.sources:
        db_episode.sources.append(db_source)
        db.commit()


@router.delete("/episodes/{episode_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_source_from_episode(
    episode_id: int,
    source_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Remove a source from an episode."""
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    db_source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    
    if db_source in db_episode.sources:
        db_episode.sources.remove(db_source)
        db.commit() 