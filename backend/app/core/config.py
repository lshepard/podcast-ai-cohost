import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base directory for the application
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Config:
    # Base paths
    BASE_DIR = BASE_DIR
    DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
    EPISODES_DIR = Path(os.getenv("EPISODES_DIR", DATA_DIR / "episodes"))
    
    # API configuration
    API_V1_STR = "/api"
    PROJECT_NAME = "Podcast Recording App"
    
    # Security for basic auth
    BASIC_AUTH_USERNAME = os.getenv("BASIC_AUTH_USERNAME", "admin")
    BASIC_AUTH_PASSWORD = os.getenv("BASIC_AUTH_PASSWORD", "password")
    
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/app.db")
    
    # LLM Configuration
    LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o")
    
    # AI Services
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
    ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")
    
    # Voice Configuration
    ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
    
    # Environment file
    env_file = ".env"
    case_sensitive = True


# Create settings instance
settings = Config()

# Ensure data directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.EPISODES_DIR, exist_ok=True) 