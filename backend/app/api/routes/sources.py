from typing import List
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import get_current_user
from app.db import models
from app.db.session import get_db
from app.lib.web import process_web_source
from app.lib.pdf import process_pdf_source
from app.lib.token_counter import count_tokens
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sources/upload-pdf", response_model=schemas.Source)
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Upload and process a PDF file."""
    try:
        # Create uploads directory if it doesn't exist
        uploads_dir = os.path.join(settings.DATA_DIR, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Save the uploaded file
        file_path = os.path.join(uploads_dir, file.filename)
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Process the PDF
        result = await process_pdf_source(file_path)
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get('error', 'Failed to process PDF')
            )
        
        # Create the source
        source_dict = {
            'source_type': models.SourceType.PDF,
            'title': file.filename,
            'content': result['content'],
            'summary': result['summary'],
            'file_path': file_path,
            'token_count': count_tokens(result['content']) if result['content'] else None
        }
        
        db_source = models.Source(**source_dict)
        db.add(db_source)
        db.commit()
        db.refresh(db_source)
        return db_source
        
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing PDF: {str(e)}"
        )


@router.post("/sources", response_model=schemas.Source)
async def create_source(
    source: schemas.SourceCreate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Create a new source."""
    try:
        logger.info(f"Creating source from : {source}")
        # Validate source type
        if source.source_type not in [models.SourceType.WEB, models.SourceType.PDF, models.SourceType.TEXT]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid source type. Must be one of: {', '.join([t.value for t in models.SourceType])}"
            )

        # Process web sources
        if source.source_type == models.SourceType.WEB and source.url:
            result = await process_web_source(source.url)
            if not result['success']:
                logger.error(f"Error processing web source: {result.get('error', 'Failed to process web source')}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result.get('error', 'Failed to process web source')
                )

            logger.info(f"Scraped content: {result['summary']}")
            # Update source with scraped content and summary
            source.content = result['content']
            source.summary = result['summary']
            source.source_type = result['source_type']  # Update source type based on URL
            
            # If no title provided, use the title from the scraped content
            if not source.title:
                source.title = result.get('title', source.url)
        
        # Create the source
        source_dict = source.model_dump()
        # Count tokens if content is available
        if source_dict.get('content'):
            source_dict['token_count'] = count_tokens(source_dict['content'])
        
        db_source = models.Source(**source_dict)
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
    
    update_data = source.model_dump(exclude_unset=True)
    
    # Count tokens if content is being updated
    if 'content' in update_data:
        update_data['token_count'] = count_tokens(update_data['content'])
    
    for field, value in update_data.items():
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