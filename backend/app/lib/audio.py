import os
import wave
import subprocess
from pathlib import Path
from typing import Optional, Tuple
import logging
import traceback

import assemblyai as aai
from google import genai
from google.genai import types

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

# Initialize Gemini client for TTS
gemini_client = None
if settings.GOOGLE_API_KEY:
    gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    logger.info("Gemini TTS client initialized")
else:
    logger.warning("GOOGLE_API_KEY not set - TTS will not be available")

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


def _write_wav_file(filename: str, pcm_data: bytes, channels: int = 1, rate: int = 24000, sample_width: int = 2):
    """Write PCM audio data to a WAV file."""
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm_data)


def _convert_wav_to_mp3(wav_path: str, mp3_path: str) -> bool:
    """Convert WAV file to MP3 using ffmpeg."""
    try:
        cmd = [
            'ffmpeg',
            '-i', wav_path,
            '-codec:a', 'libmp3lame',
            '-qscale:a', '2',
            '-y',
            mp3_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            # Remove the temporary WAV file
            os.remove(wav_path)
            return True
        else:
            logger.error(f"ffmpeg conversion failed: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Error converting WAV to MP3: {e}")
        return False


def generate_speech(text: str, output_path: str) -> Tuple[bool, str, Optional[str]]:
    """
    Converts text to speech using Gemini TTS and saves the output as an MP3 file.

    Args:
        text (str): The text content to convert to speech.
        output_path (str): Complete path to save the audio file (should end in .mp3).

    Returns:
        Tuple[bool, str, Optional[str]]: (success, message, file_path)
    """
    try:
        if not gemini_client:
            return False, "Gemini TTS client not initialized. Check GOOGLE_API_KEY.", None

        # Gemini TTS settings
        voice_name = settings.GEMINI_TTS_VOICE
        model = "gemini-2.5-flash-preview-tts"

        logger.info(f"Starting Gemini TTS. Voice: {voice_name}, Model: {model}, Path: {output_path}")
        logger.info(f"Text length: {len(text)} characters")

        # Handle relative paths by prefixing with EPISODES_DIR if they start with /episodes/
        if output_path.startswith('/episodes/'):
            relative_path = output_path.replace('/episodes/', '', 1)
            full_path = os.path.join(str(settings.EPISODES_DIR), relative_path)
        else:
            full_path = output_path

        # Ensure directory exists
        output_dir = os.path.dirname(full_path)
        os.makedirs(output_dir, exist_ok=True)
        logger.info(f"Directory created/verified: {output_dir}")

        try:
            logger.info("Making Gemini TTS API call...")

            response = gemini_client.models.generate_content(
                model=model,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice_name,
                            )
                        )
                    ),
                )
            )

            logger.info("Gemini TTS API call completed successfully")

            # Extract audio data from response
            audio_data = response.candidates[0].content.parts[0].inline_data.data

            if not audio_data:
                logger.error("API returned empty response (no audio data)")
                return False, "No audio data received from Gemini TTS API", None

            logger.info(f"Received {len(audio_data)} bytes of audio data")

            # Write to temporary WAV file first
            wav_path = full_path.replace('.mp3', '.wav')
            _write_wav_file(wav_path, audio_data)
            logger.info(f"Wrote WAV file: {wav_path}")

            # Convert to MP3
            if _convert_wav_to_mp3(wav_path, full_path):
                logger.info(f"Converted to MP3: {full_path}")
            else:
                # If conversion fails, keep the WAV file and update the path
                full_path = wav_path
                output_path = output_path.replace('.mp3', '.wav')
                logger.warning(f"MP3 conversion failed, keeping WAV file: {full_path}")

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
            logger.error(f"Gemini TTS API error: {error_detail}")
            logger.error(f"Stack trace: {stack_trace}")
            return False, f"Gemini TTS API error: {error_detail}", None

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