"""Password hashing, JWT tokens, and the auth dependencies used by routes.

Access levels:
  - anyone: read-only endpoints
  - signed-in user (`require_user`): add/edit records, Game Mode
  - admin (`require_admin`): delete records, bulk upload, MLB import
The first account ever registered becomes the admin.
"""

from datetime import UTC, datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY
from backend.database import get_db
from backend.models import User

ALGORITHM = "HS256"
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pw = plain_password.encode("utf-8")
    if len(pw) > 72:  # longer passwords can't be registered
        return False
    try:
        return bcrypt.checkpw(pw, hashed_password.encode("utf-8"))
    except ValueError:  # malformed hash
        return False


def create_access_token(user: User, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _unauthorized(detail: str = "Please sign in to do that.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if creds is None:
        return None
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise _unauthorized("Your session has expired. Please sign in again.") from None
    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized("Your session has expired. Please sign in again.")
    return user


def require_user(user: Optional[User] = Depends(get_optional_user)) -> User:
    if user is None:
        raise _unauthorized()
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an admin can do that.")
    return user
