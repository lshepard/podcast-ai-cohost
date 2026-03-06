from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.api import schemas
from app.api.deps import get_current_user
from app.db import models
from app.db.session import get_db

router = APIRouter()


@router.get("/search", response_model=schemas.SearchResults)
def search_content(
    q: str = Query(..., description="Search query"),
    content_type: Optional[str] = Query(None, description="Filter by content type: episodes, segments, sources, or all"),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Search across episodes, segments, and sources."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    
    search_term = f"%{q.strip()}%"
    results = schemas.SearchResults(episodes=[], segments=[], sources=[])
    
    # Search episodes
    if content_type is None or content_type == "all" or content_type == "episodes":
        episodes = db.query(models.Episode).filter(
            or_(
                models.Episode.title.ilike(search_term),
                models.Episode.description.ilike(search_term),
                models.Episode.notes.ilike(search_term)
            )
        ).all()
        results.episodes = episodes
    
    # Search segments
    if content_type is None or content_type == "all" or content_type == "segments":
        segments = db.query(models.Segment).filter(
            models.Segment.text_content.ilike(search_term)
        ).all()
        results.segments = segments
    
    # Search sources
    if content_type is None or content_type == "all" or content_type == "sources":
        sources = db.query(models.Source).filter(
            or_(
                models.Source.title.ilike(search_term),
                models.Source.content.ilike(search_term),
                models.Source.summary.ilike(search_term)
            )
        ).all()
        results.sources = sources
    
    return results 