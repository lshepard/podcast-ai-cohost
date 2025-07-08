import os
from pathlib import Path
from typing import Optional, Tuple
import logging
import traceback

import assemblyai as aai

from elevenlabs import VoiceSettings
from elevenlabs.client import ElevenLabs
import uuid

from app.core.config import settings
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import Segment

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Ensure debug-level messages are captured

# Initialize APIs if keys are available
if settings.ASSEMBLYAI_API_KEY:
    aai.settings.api_key = settings.ASSEMBLYAI_API_KEY

# Initialize ElevenLabs client
if not settings.ELEVENLABS_API_KEY:
    raise ValueError("ELEVENLABS_API_KEY environment variable not set")

client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

# Verify the ElevenLabs API key on startup
def check_elevenlabs_key():
    try:
        logger.info("Checking ElevenLabs API key validity...")
        # Try to list voices, which requires a valid API key
        voices_response = client.voices.get_all()
        voices = voices_response.voices  # This is likely a list
        
        logger.info(f"ElevenLabs API key is valid. Found {len(voices)} voices available.")
        
        # Log available voices for debugging
        for voice in voices:
            logger.info(f"Voice available: ID={voice.voice_id}, Name={voice.name}")
        
        return True, "API key is valid"
    except Exception as e:
        error_msg = str(e)
        logger.error(f"ElevenLabs API key validation failed: {error_msg}")
        if "401" in error_msg:
            logger.critical("Authentication failed: Invalid ElevenLabs API key")
        return False, f"API key validation failed: {error_msg}"

# Perform initial check
key_valid, key_message = check_elevenlabs_key()
if not key_valid:
    logger.warning(f"ElevenLabs API key issue: {key_message}")

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
        voice = settings.ELEVENLABS_VOICE_ID
        model = "eleven_multilingual_v2"
        speed = 1.0
        stability = 0.4
        similarity = 0.7
        style_exaggeration = 0.4

        # Log key parameters
        logger.debug(f"ElevenLabs API Key: {'*****' + settings.ELEVENLABS_API_KEY[-4:] if settings.ELEVENLABS_API_KEY else 'Not set'}")
        logger.info(f"Starting speech generation. Voice ID: {voice}, Model: {model}, Path: {output_path}")
        logger.info(f"Text length: {len(text)} characters")

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
        logger.info(f"Directory created/verified: {output_dir}")

        try:
            # Prepare API call parameters for logging
            api_params = {
                "voice_id": voice,
                "speed": speed,
                "optimize_streaming_latency": "0",
                "output_format": "mp3_22050_32",
                "model_id": model,
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": similarity,
                    "style": style_exaggeration,
                    "use_speaker_boost": True,
                }
            }
            logger.info(f"API call parameters: {api_params}")
            
            # Log that we're making the API call
            logger.info("Making ElevenLabs API call...")
            
            # Make the API call
            response = client.text_to_speech.convert(
                voice_id=voice,
                optimize_streaming_latency="0",
                output_format="mp3_22050_32",
                text=text,
                model_id=model,
                voice_settings=VoiceSettings(
                    speed=speed,
                    stability=stability,
                    similarity_boost=similarity,
                    style=style_exaggeration,
                    use_speaker_boost=True,
                ),
            )
            
            logger.info("ElevenLabs API call completed successfully")
            
            # Save response to file
            byte_count = 0
            with open(full_path, "wb") as f:
                logger.info("Writing audio data to file...")
                for chunk in response:
                    if chunk:
                        byte_count += len(chunk)
                        f.write(chunk)
            
            logger.info(f"Finished writing file. Total bytes: {byte_count}")
            
            # Verify the file was created with content
            if byte_count == 0:
                logger.error("API returned empty response (no audio data)")
                return False, "No audio data received from ElevenLabs API", None
                
            # Verify file exists and has appropriate size
            if not os.path.exists(full_path):
                logger.error(f"File doesn't exist after writing: {full_path}")
                return False, f"File doesn't exist after writing: {full_path}", None
                
            file_size = os.path.getsize(full_path)
            logger.info(f"File size verification: {file_size} bytes")
            
            if file_size == 0:
                logger.error(f"File is empty: {full_path}")
                return False, f"File is empty: {full_path}", None
                
            logger.info(f"Audio generation successful: {output_path}")
            return True, f"Audio file saved at {output_path}", output_path
            
        except Exception as api_error:
            error_detail = str(api_error)
            stack_trace = traceback.format_exc()
            logger.error(f"ElevenLabs API error: {error_detail}")
            logger.error(f"Stack trace: {stack_trace}")
            
            # Check for common error patterns
            if "401" in error_detail:
                return False, "ElevenLabs API authentication failed. Check your API key.", None
            elif "429" in error_detail:
                return False, "ElevenLabs API rate limit exceeded. Try again later.", None
            elif "voice_id" in error_detail.lower():
                return False, f"Voice ID '{voice}' not found or not available with your account.", None
            elif "characters" in error_detail.lower() or "length" in error_detail.lower():
                return False, "Text too long for ElevenLabs API limits.", None
            else:
                return False, f"ElevenLabs API error: {error_detail}", None

    except Exception as e:
        error_detail = str(e)
        stack_trace = traceback.format_exc()
        logger.error(f"Error generating speech: {error_detail}")
        logger.error(f"Stack trace: {stack_trace}")
        return False, f"Error generating speech: {error_detail}", None 

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def update_segment_text_content(episode_id, segment_id, text):
    session = SessionLocal()
    try:
        segment = session.query(Segment).filter(Segment.episode_id == episode_id, Segment.id == segment_id).first()
        if segment:
            segment.text_content = text
            session.commit()
    finally:
        session.close() 