# Podcast Recording Application

An application for creating podcasts with a human host and AI companion.

## Features

- Record human audio segments
- Generate AI responses with customizable prompts
- Convert AI text to speech using Elevenlabs
- Edit transcripts and re-generate audio
- Parallel display of draft text, audio, and transcript
- Transcription via AssemblyAI

## Tech Stack

- Backend: Python, FastAPI
- Frontend: React, TypeScript
- Audio Processing: FFmpeg
- AI Models: OpenAI GPT-4, Elevenlabs
- Deployment: Docker

## Getting Started

### Prerequisites

- Python 3.9+ 
- Node.js 18+
- FFmpeg (for audio processing)
- API keys for OpenAI, ElevenLabs, and AssemblyAI

### Setup Environment

1. Clone the repository:
```bash
git clone <repository-url>
cd podcast-recording
```

2. Create and configure environment files:
```bash
# Copy sample environment files
cp backend/.env.sample backend/.env
cp frontend/.env.sample frontend/.env

# Edit the .env files with your API keys
```

3. Run the setup script (simplest method):
```bash
chmod +x run_dev.sh
./run_dev.sh
```

### Running with uv (Recommended)

This project uses [uv](https://github.com/astral-sh/uv), a fast Python package installer and resolver.

#### First time setup:

```bash
# Install uv if you don't have it
pip install uv

# Set up the backend environment
cd backend
uv sync

# Set up the frontend
cd ../frontend
npm install
```

#### Running the application:

```bash
# Run the backend with uv
cd backend
uv run -- uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, run the frontend
cd frontend
npm start
```

#### Managing dependencies:

```bash
# Add a new dependency
cd backend
uv add package_name

# Remove a dependency
uv remove package_name

# Update a dependency
uv lock --upgrade-package package_name
```

### Alternative: Running with Docker

```bash
# Start both backend and frontend
docker-compose up

# Or build and start
docker-compose up --build
```

## API Documentation

Once the application is running, you can access the API documentation at:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Usage

1. Open the application in your browser at http://localhost:3000
2. Create a new podcast episode
3. Add segments (human recordings or AI responses)
4. Edit transcriptions and generate speech as needed
5. Export the completed podcast

## Configuration

The application can be configured using environment variables in the `.env` files:

### Backend Configuration
- `OPENAI_API_KEY`: Your OpenAI API key
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key
- `ASSEMBLYAI_API_KEY`: Your AssemblyAI API key
- `LLM_MODEL`: The OpenAI model to use (default: gpt-4o)
- `ELEVENLABS_VOICE_ID`: Voice ID for speech synthesis

### Frontend Configuration
- `REACT_APP_API_URL`: URL for the backend API 