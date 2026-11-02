from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import ALLOW_REGISTRATION
from backend.database import get_db
from backend.models import User
from backend.schemas import AuthResponse, LoginBody, RegisterBody, UserOut
from backend.services.auth_service import create_access_token, hash_password, require_user, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])

# Compared against when the username doesn't exist, so a wrong username and a
# wrong password take the same time.
_DUMMY_HASH = hash_password("timing-equalizer")


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, username=user.username, email=user.email, is_admin=bool(user.is_admin))


@router.get("/config")
def auth_config(db: Session = Depends(get_db)) -> dict:
    """Tells the frontend whether sign-ups are open."""
    has_users = bool(db.scalar(select(func.count()).select_from(User)))
    return {"registration_open": ALLOW_REGISTRATION or not has_users, "has_users": has_users}


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterBody, db: Session = Depends(get_db)) -> AuthResponse:
    user_count = db.scalar(select(func.count()).select_from(User)) or 0
    if user_count and not ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is closed. Ask the admin for an account.")

    if db.scalar(select(User).where(func.lower(User.username) == body.username.lower())):
        raise HTTPException(status_code=409, detail="That username is taken.")
    if db.scalar(select(User).where(func.lower(User.email) == body.email.lower())):
        raise HTTPException(status_code=409, detail="That email is already registered.")

    user = User(
        username=body.username,
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        is_admin=user_count == 0,  # first account runs the place
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That username or email is already registered.") from None
    db.refresh(user)
    return AuthResponse(access_token=create_access_token(user), user=_user_out(user))


@router.post("/login", response_model=AuthResponse)
def login(body: LoginBody, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(func.lower(User.username) == body.username.strip().lower()))
    valid = verify_password(body.password, user.hashed_password if user else _DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password.")
    return AuthResponse(access_token=create_access_token(user), user=_user_out(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(require_user)) -> UserOut:
    return _user_out(current_user)
