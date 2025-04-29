#!/bin/bash
set -e

echo "🎙️ Setting up Podcast Recording App 🎙️"

# Check for required tools
command -v uv >/dev/null 2>&1 || { echo "❌ uv is required but not installed. Install with: pip install uv"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node.js is required but not installed."; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "⚠️ Warning: ffmpeg not found. Audio processing may not work correctly."; }

# Ensure environment files exist
if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env from sample..."
    cp backend/.env.sample backend/.env
    echo "⚠️ Please edit backend/.env with your API keys."
fi

if [ ! -f "frontend/.env" ]; then
    echo "Creating frontend/.env from sample..."
    cp frontend/.env.sample frontend/.env
fi

# Setup backend
echo "🔧 Setting up backend..."
cd backend

# Create a Python version file if not exists
if [ ! -f ".python-version" ]; then
    echo "3.9" > .python-version
    echo "Created .python-version file specifying Python 3.9"
fi

# Create and sync the project environment
uv sync
echo "✅ Backend setup complete!"
cd ..

# Create data directories
mkdir -p data/episodes

# Setup frontend
echo "🔧 Setting up frontend..."
cd frontend
npm install
cd ..
echo "✅ Frontend setup complete!"

echo ""
echo "🚀 Setup complete! To run the application:"
echo ""
echo "In one terminal:"
echo "  cd backend"
echo "  uv run -- uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "In another terminal:"
echo "  cd frontend"
echo "  npm start"
echo ""
echo "Alternatively, you can activate the virtual environment manually:"
echo "  cd backend"
echo "  source .venv/bin/activate  # On Windows: .venv\\Scripts\\activate"
echo "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "Then open http://localhost:3000 in your browser" 