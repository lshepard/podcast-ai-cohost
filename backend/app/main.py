from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import os
import logging
import sys
from logging.handlers import RotatingFileHandler

from app.api.routes import audio, episodes, generate, segments, sources
from app.core.config import settings
from app.db.session import init_db
from app.admin import mount_admin

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        # Console handler
        logging.StreamHandler(sys.stdout),
        # File handler with rotation
        RotatingFileHandler(
            os.path.join(settings.DATA_DIR, 'app.log'),
            maxBytes=10*1024*1024,  # 10 MB
            backupCount=5,
            encoding='utf-8'
        )
    ]
)

# Set specific logger levels
logging.getLogger('app.lib.audio').setLevel(logging.DEBUG)

# Initialize the database
init_db()

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

mount_admin(app)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware to add CORS headers to static files
class StaticFilesCORS(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/episodes/"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response

app.add_middleware(StaticFilesCORS)

# Mount the episodes directory as a static file directory
# This makes files accessible without authentication at /episodes/...
os.makedirs(settings.EPISODES_DIR, exist_ok=True)
app.mount("/episodes", StaticFiles(directory=str(settings.EPISODES_DIR)), name="episodes")

# Custom static file handler for audio files
@app.get("/episodes/{path:path}")
async def serve_audio_file(path: str, request: Request):
    file_path = os.path.join(settings.EPISODES_DIR, path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    response = FileResponse(file_path)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Include API routers
app.include_router(episodes.router, prefix=settings.API_V1_STR)
app.include_router(segments.router, prefix=settings.API_V1_STR)
app.include_router(audio.router, prefix=settings.API_V1_STR)
app.include_router(generate.router, prefix=settings.API_V1_STR)
app.include_router(sources.router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": f"Welcome to the {settings.PROJECT_NAME} API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 