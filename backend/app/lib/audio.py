import os
from pathlib import Path
from typing import Optional, Tuple

import assemblyai as aai

from elevenlabs import VoiceSettings
from elevenlabs.client import ElevenLabs
import uuid

from app.core.config import settings
from dotenv import load_dotenv

load_dotenv()

# Initialize APIs if keys are available
if settings.ASSEMBLYAI_API_KEY:
    aai.settings.api_key = settings.ASSEMBLYAI_API_KEY

# Initialize ElevenLabs client
if not settings.ELEVENLABS_API_KEY:
    raise ValueError("ELEVENLABS_API_KEY environment variable not set")

client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

def transcribe_audio(audio_file_path: str) -> Tuple[bool, str, Optional[str]]:
    """Transcribe audio file using AssemblyAI.
    
    Args:
        audio_file_path: Path to the audio file
        
    Returns:
        Tuple of (success, message, transcription)
    """
    if not settings.ASSEMBLYAI_API_KEY:
        return False, "AssemblyAI API key not configured", None
    
    try:
        # Create a transcriber
        transcriber = aai.Transcriber()
        
        # Start transcription
        transcript = transcriber.transcribe(audio_file_path)
        
        # Check if transcription succeeded
        if transcript.status == "completed":
            return True, "Transcription completed successfully", transcript.text
        else:
            return False, f"Transcription failed with status: {transcript.status}", None
    
    except Exception as e:
        return False, f"Error during transcription: {str(e)}", None


def generate_speech(text: str, output_path: str) -> Tuple[bool, str, Optional[str]]:
    """
    Converts text to speech and saves the output as an MP3 file.

    Args:
        text (str): The text content to convert to speech.
        output_path (str): Complete path to save the audio file.

    Returns:
        Tuple[bool, str, Optional[str]]: (success, message, file_path)
    """
    try:
        # Hard-coded ElevenLabs settings
        voice = "AZnzlk1XvdvUeBnXmlld" # Domi
        model = "eleven_multilingual_v2"
        speed = 1.0
        stability = 0.5
        similarity = 0.8
        style_exaggeration = 0.2

        # Handle relative paths by prefixing with EPISODES_DIR if they start with /episodes/
        if output_path.startswith('/episodes/'):
            # Remove the leading "/episodes/" part
            relative_path = output_path.replace('/episodes/', '', 1)
            # Join with the actual episodes directory
            full_path = os.path.join(str(settings.EPISODES_DIR), relative_path)
        else:
            full_path = output_path

        # Ensure directory exists
        output_dir = os.path.dirname(full_path)
        os.makedirs(output_dir, exist_ok=True)

        response = client.text_to_speech.convert(
            voice_id=voice,
            optimize_streaming_latency="0",
            output_format="mp3_22050_32",
            text=text,
            model_id=model,
            voice_settings=VoiceSettings(
                stability=stability,
                similarity_boost=similarity,
                style=style_exaggeration,
                use_speaker_boost=True,
            ),
        )

        with open(full_path, "wb") as f:
            for chunk in response:
                if chunk:
                    f.write(chunk)

        return True, f"Audio file saved at {output_path}", output_path

    except Exception as e:
        return False, f"Error generating speech: {str(e)}", None 