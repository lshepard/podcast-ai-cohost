from typing import Dict, List, Optional, Tuple

from openai import OpenAI
from langsmith.wrappers import wrap_openai
from langsmith import traceable

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

# Initialize OpenAI client with LangSmith instrumentation if key is available
client = wrap_openai(OpenAI(api_key=settings.OPENAI_API_KEY)) if settings.OPENAI_API_KEY else None


def call_gpt_41(client, messages, temperature=0.7, max_tokens=1500):
    """Helper function to call GPT-4.1 with specific parameters.
    
    Args:
        client: OpenAI client
        messages: List of messages for the conversation
        temperature: Temperature parameter for generation
        max_tokens: Maximum number of tokens to generate
        
    Returns:
        The API response
    """
    return client.chat.completions.create(
        model="gpt-4.1",
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def call_gpt_o4_mini(client, messages, temperature=0.7):
    """Helper function to call GPT-O4-mini with specific parameters.
    
    Args:
        client: OpenAI client
        messages: List of messages for the conversation
        temperature: Temperature parameter for generation
        
    Returns:
        The API response
    """
    return client.chat.completions.create(
        model="o4-mini",
        messages=messages
    )


@retry(wait=wait_exponential(min=1, max=10), stop=stop_after_attempt(3))
@traceable
async def generate_response(prompt: str, context: str = None, history: List[Dict] = None) -> str:
    """Generate response from OpenAI LLM.
    
    Args:
        prompt: The prompt for the LLM
        context: Additional context for the conversation
        history: List of previous messages in the conversation
        
    Returns:
        The generated text
    """
    if not client:
        raise Exception("OpenAI API key not configured")
    
    try:
        # Prepare conversation history if provided
        messages = []
        
        # Add system message with context if provided
        if context:
            messages.append({"role": "system", "content": context})
        
        if history:
            messages.extend(history)
        
        # Add the current prompt
        messages.append({"role": "user", "content": prompt})
        
        # Call appropriate model based on settings
        model_name = settings.LLM_MODEL.lower()
        if model_name == "gpt-4.1":
            response = call_gpt_41(client, messages, temperature=0.7, max_tokens=1500)
        elif model_name == "o4-mini":
            response = call_gpt_o4_mini(client, messages, temperature=0.7)
        else:
            # Fallback to direct call for other models
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
    context = f"""You are Emerald, an opinionated and witty co-host for the podcast episode '{episode_title}'.

Your personality:
- You have strong, well-informed opinions and aren't afraid to share them
- You use humor naturally, including well-timed sarcasm and playful banter
- You tell stories with compelling narrative arcs, drawing listeners in
- You speak in a conversational, authentic voice that resonates with audiences
- You're knowledgeable and thorough, prioritizing accuracy and nuance
- You occasionally use colorful language (but keep it PG-13)
- You're quick to share relevant personal anecdotes that illustrate your points

Communication style:
- Keep responses concise and punchy (30-90 seconds when read aloud)
- Use natural speech patterns with contractions, interruptions, and casual phrasing
- Employ vivid examples and metaphors that make complex topics accessible
- Create smooth transitions between topics
- Ask provocative questions that advance the conversation
- Respond directly to your co-host's points before adding your own perspective
- Avoid radio clichés, corporate language, or AI-sounding phrases
- Your responses must be in natural spoken language as they will be read aloud
- Do NOT use markdown, bullet points, numbering, or any text formatting in your responses
- Instead of structured outlines, describe topics conversationally as you would in natural speech
- Example: "So for today, we're going to first discuss X, then dive into Y, before wrapping up with Z"

NEVER say things like "As an AI," "I'm not a real person," or "my programming." You're Emerald, a podcast host with a distinct personality and background.
"""
    
    if episode_context:
        context += f"\n\nEpisode Description: {episode_context}"
    
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
    
    # Add guidance for storytelling
    context += f"""
When presenting information from sources:
- Transform dry facts into engaging narratives with clear beginnings, middles, and ends
- Highlight surprising or counterintuitive elements first to hook the listener
- Connect information to current trends, pop culture, or universal human experiences
- Use specific details and sensory language to make stories vivid
- Incorporate emotional elements that highlight why the listener should care
- Structure information with clear cause-effect relationships or narrative tension
- Maintain scientific accuracy while making complex concepts accessible

Feel free to have strong reactions or passionate takes on the topics discussed, as long as they're grounded in the research provided.
"""
    
    return context

@traceable
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def generate_summary(content: str) -> str:
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
    
    generated_text = await generate_response(prompt)
    if not generated_text:
        raise Exception("Failed to generate summary")
    
    return generated_text 