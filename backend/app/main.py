from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.routes import audio, episodes, generate, segments
from app.core.config import settings
from app.db.session import init_db
from app.admin import mount_admin

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

# Mount the episodes directory as a static file directory
# This makes files accessible without authentication at /episodes/...
os.makedirs(settings.EPISODES_DIR, exist_ok=True)
app.mount("/episodes", StaticFiles(directory=str(settings.EPISODES_DIR)), name="episodes")

# Include API routers
app.include_router(episodes.router, prefix=settings.API_V1_STR)
app.include_router(segments.router, prefix=settings.API_V1_STR)
app.include_router(audio.router, prefix=settings.API_V1_STR)
app.include_router(generate.router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": f"Welcome to the {settings.PROJECT_NAME} API"}


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 