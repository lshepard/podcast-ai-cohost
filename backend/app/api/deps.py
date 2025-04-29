from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core.config import settings

# Set up HTTP Basic Auth
security = HTTPBasic()


def get_current_user(credentials: HTTPBasicCredentials = Depends(security)):
    """Validate HTTP Basic Auth credentials."""
    is_username_correct = credentials.username == settings.BASIC_AUTH_USERNAME
    is_password_correct = credentials.password == settings.BASIC_AUTH_PASSWORD
    
    if not (is_username_correct and is_password_correct):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    return credentials.username 