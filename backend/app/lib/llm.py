from typing import Dict, List, Optional, Tuple

from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

# Initialize OpenAI client if key is available
client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None


@retry(wait=wait_exponential(min=1, max=10), stop=stop_after_attempt(3))
async def generate_response(prompt: str, history: List[Dict] = None) -> str:
    """Generate response from OpenAI LLM.
    
    Args:
        prompt: The prompt for the LLM
        history: List of previous messages in the conversation
        
    Returns:
        The generated text
    """
    if not client:
        raise Exception("OpenAI API key not configured")
    
    try:
        # Prepare conversation history if provided
        messages = []
        
        if history:
            messages.extend(history)
        
        # Add the current prompt
        messages.append({"role": "user", "content": prompt})
        
        # Generate response
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1500,
        )
        
        # Extract the generated text
        return response.choices[0].message.content
    
    except Exception as e:
        raise Exception(f"Error generating text: {str(e)}")


def prepare_podcast_context(episode_title: str, episode_context: str = None, episode_notes: str = None, sources: list = None) -> str:
    """Prepare context for the podcast generation.
    
    Args:
        episode_title: Title of the episode
        episode_context: Additional context for the episode
        episode_notes: Additional notes, script, and important info for the episode
        sources: List of sources attached to the episode
        
    Returns:
        Formatted context string
    """
    context = f"""You are an AI co-host for a podcast episode titled '{episode_title}'. 
Respond in a conversational way that would work well in an audio format.
Keep your responses concise, engaging, and suitable for a podcast conversation.
Use natural transitions and avoid phrases like "As an AI" or similar robotic language.
"""
    
    if episode_context:
        context += f"\nEpisode Description: {episode_context}"
    
    if episode_notes:
        context += f"\n\nEpisode Notes and Script:\n{episode_notes}"
    
    # Add source context if available
    if sources:
        context += "\n\nResearch Sources and Background Information:\n"
        for source in sources:
            source_info = f"\nSource: {source.title}"
            if source.source_type:
                source_info += f" (Type: {source.source_type.value})"
            if source.url:
                source_info += f"\nURL: {source.url}"
            if source.summary:
                source_info += f"\nSummary: {source.summary}"
            if source.content:
                source_info += f"\nFull Content:\n{source.content}"
            context += source_info + "\n"
    
    return context 


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def generate_summary(content: str) -> str:
    """
    Generate a summary of the given content using the LLM.
    
    Args:
        content (str): The content to summarize
        
    Returns:
        str: The generated summary
    """
    prompt = f"""Please summarize the following content. Focus on the main points and key information.
Keep the summary concise and informative.

Content:
{content}
"""
    
    generated_text = generate_response(prompt)
    if not generated_text:
        raise Exception("Failed to generate summary")
    
    return generated_text 