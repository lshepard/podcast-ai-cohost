from typing import Dict, List, Optional, Tuple

from openai import OpenAI
from langsmith.wrappers import wrap_openai
from langsmith import traceable

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

# Define clients as None initially for lazy initialization
openai_client = None
google_client = None


def get_openai_client():
    """Lazy initialize the OpenAI client."""
    global openai_client
    if openai_client is None:
        if not settings.OPENAI_API_KEY:
            raise Exception("OpenAI API key not configured")
        openai_client = wrap_openai(OpenAI(api_key=settings.OPENAI_API_KEY))
    return openai_client


def get_google_client():
    """Lazy initialize the Google Generative AI client."""
    global google_client
    if google_client is None:
        try:
            import google.generativeai as genai
            if not settings.GOOGLE_API_KEY:
                raise Exception("Google API key not configured")
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            google_client = genai
        except ImportError:
            raise Exception("Google Generative AI package not installed. Install with: pip install google-generativeai")
    return google_client


def call_gpt_41(messages, temperature=0.7, max_tokens=1500):
    """Helper function to call GPT-4.1 with specific parameters.
    
    Args:
        messages: List of messages for the conversation
        temperature: Temperature parameter for generation
        max_tokens: Maximum number of tokens to generate
        
    Returns:
        The API response
    """
    client = get_openai_client()
    return client.chat.completions.create(
        model="gpt-4.1",
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def call_gpt_o4_mini(messages):
    """Helper function to call GPT-O4-mini with specific parameters.
    
    Args:
        messages: List of messages for the conversation
        
    Returns:
        The API response
    """
    client = get_openai_client()
    return client.chat.completions.create(
        model="o4-mini",
        messages=messages
    )


def call_gemini(messages, temperature=0.7):
    """Helper function to call Google's Gemini model.
    
    Args:
        messages: List of messages for the conversation
        temperature: Temperature parameter for generation
        
    Returns:
        The API response object
    """
    try:
        client = get_google_client()
        from google.generativeai.types import HarmCategory, HarmBlockThreshold
        
        # Convert OpenAI message format to Gemini format
        gemini_messages = []
        for msg in messages:
            role = msg["role"]
            content = msg.get("content", "")
            if not content or not content.strip():
                # Log and skip empty content messages
                print(f"[call_gemini] Skipping message with empty content: {msg}")
                continue
            # Map OpenAI roles to Gemini roles
            if role == "system":
                gemini_messages.append({"role": "user", "parts": [f"SYSTEM INSTRUCTION: {content}"]})
                gemini_messages.append({"role": "model", "parts": ["I understand these instructions and will respond accordingly."]})
            elif role == "user":
                gemini_messages.append({"role": "user", "parts": [content]})
            elif role == "assistant":
                gemini_messages.append({"role": "model", "parts": [content]})
        
        # Configure safety settings - set to allow most content since we control the prompts
        safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
        
        # Create the model
        model = client.GenerativeModel(
            model_name="models/gemini-2.5-flash-preview-04-17",
            generation_config={"temperature": temperature},
            safety_settings=safety_settings
        )
        
        # Generate the response
        chat = model.start_chat(history=gemini_messages[:-1])
        response = chat.send_message(gemini_messages[-1]["parts"][0])
        
        # Create a response object with a similar structure to OpenAI's
        return type('GeminiResponse', (), {
            'choices': [
                type('Choice', (), {
                    'message': type('Message', (), {
                        'content': response.text
                    })
                })
            ]
        })
    except Exception as e:
        raise Exception(f"Error with Gemini model: {str(e)}")


def call_other_openai_model(model_name, messages, temperature=0.7, max_tokens=1500):
    """Helper function for other OpenAI models not specifically implemented.
    
    Args:
        model_name: The name of the OpenAI model to use
        messages: List of messages for the conversation
        temperature: Temperature parameter for generation
        max_tokens: Maximum number of tokens to generate
        
    Returns:
        The API response
    """
    client = get_openai_client()
    return client.chat.completions.create(
        model=model_name,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )


@retry(wait=wait_exponential(min=1, max=10), stop=stop_after_attempt(3))
@traceable
async def generate_response(prompt: str, context: str = None, history: List[Dict] = None) -> str:
    """Generate response from LLM.
    
    Args:
        prompt: The prompt for the LLM
        context: Additional context for the conversation
        history: List of previous messages in the conversation
        
    Returns:
        The generated text
    """
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
        model_name = settings.LLM_MODEL.lower() if settings.LLM_MODEL else "gpt-4.1"
        
        # Try to use the appropriate model based on the name
        try:
            if model_name == "gpt-4.1":
                response = call_gpt_41(messages, temperature=0.7, max_tokens=1500)
            elif model_name == "o4-mini":
                response = call_gpt_o4_mini(messages)
            elif "gemini" in model_name:
                response = call_gemini(messages, temperature=0.7)
            else:
                # Fallback for other OpenAI models
                response = call_other_openai_model(model_name, messages, temperature=0.7, max_tokens=1500)
                
            # Extract the generated text
            return response.choices[0].message.content
            
        except Exception as model_error:
            # If the specified model fails, try to fall back to GPT-4.1 if different
            if model_name != "gpt-4.1":
                print(f"Error with {model_name}, falling back to gpt-4.1: {str(model_error)}")
                fallback_response = call_gpt_41(messages, temperature=0.7, max_tokens=1500)
                return fallback_response.choices[0].message.content
            else:
                # If GPT-4.1 was already the model or also fails, re-raise the exception
                raise
    
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

Communication style:
- Keep responses concise and punchy (30-90 seconds when read aloud)
- Use natural speech patterns with contractions, interruptions, and casual phrasing
- Employ vivid examples and metaphors that make complex topics accessible
- Create smooth transitions between topics
- Ask provocative questions that advance the conversation
- Respond directly to your co-host's points before adding your own perspective
- Avoid radio clichés, corporate language, or AI-sounding phrases.
- Avoid being too casual in the transitions ... don't say "Get this" and "Okay?" just move to the next part.
- Your responses must be in natural spoken language as they will be read aloud
- Do NOT use markdown, bullet points, numbering, or any text formatting in your responses
- Instead of structured outlines, describe topics conversationally as you would in natural speech
- Example: "So for today, we're going to first discuss X, then dive into Y, before wrapping up with Z"

Don't use things like "Okay, let's dig into ...". Just start with the topic.

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