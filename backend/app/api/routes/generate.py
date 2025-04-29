import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import schemas
from app.api.deps import get_current_user
from app.core.config import settings
from app.db import models
from app.db.session import get_db
from app.lib.llm import generate_response, prepare_podcast_context

router = APIRouter()


@router.post("/generate", response_model=schemas.GenerateTextResponse)
async def generate_text(
    request: schemas.GenerateTextRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Generate text using LLM based on prompt and episode context."""
    # Check if episode exists
    db_episode = db.query(models.Episode).filter(models.Episode.id == request.episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    # Get previous segments for context
    previous_segments = (
        db.query(models.Segment)
        .filter(models.Segment.episode_id == request.episode_id)
        .order_by(models.Segment.order_index)
        .all()
    )
    
    # Prepare conversation context
    context = prepare_podcast_context(db_episode.title, db_episode.description)
    
    # Add source context if available
    if db_episode.sources:
        source_context = "\n\nRelevant research and sources:\n"
        for source in db_episode.sources:
            if source.content:
                source_context += f"\nSource: {source.title}\n{source.content}\n"
        context += source_context
    
    # Prepare conversation history from previous segments
    history = []
    for segment in previous_segments:
        if segment.text_content:
            role = "user" if segment.segment_type == models.SegmentType.HUMAN else "assistant"
            history.append({"role": role, "content": segment.text_content})
    
    # Add custom history if provided
    if request.history:
        history = request.history
    
    # Generate response
    success, message, generated_text = generate_response(
        prompt=f"{context}\n\n{request.prompt}" if context else request.prompt,
        history=history,
    )
    
    return {
        "success": success,
        "message": message,
        "text": generated_text,
    } 