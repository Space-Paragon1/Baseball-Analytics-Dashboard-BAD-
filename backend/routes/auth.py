from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.config import ALLOW_REGISTRATION
from backend.database import get_db
from backend.models import User
from backend.schemas import AuthResponse, ChangePasswordBody, LoginBody, RegisterBody, UserOut
from backend.services.accounts import create_account, record_sign_in, set_password
from backend.services.auth_service import create_access_token, hash_password, require_user, verify_password
from backend.services.rate_limit import client_ip, login_limiter, too_many_attempts

router = APIRouter(prefix="/auth", tags=["Auth"])

# Compared against when the username doesn't exist, so a wrong username and a
# wrong password take the same time.
_DUMMY_HASH = hash_password("timing-equalizer")


def user_out(user: User) -> UserOut:
    return UserOut(id=user.id, username=user.username, email=user.email, is_admin=bool(user.is_admin))


def _signed_in(user: User) -> AuthResponse:
    return AuthResponse(access_token=create_access_token(user), user=user_out(user))


@router.get("/config")
def auth_config(db: Session = Depends(get_db)) -> dict:
    """Tells the frontend whether sign-ups are open."""
    has_users = bool(db.scalar(select(func.count()).select_from(User)))
    return {"registration_open": ALLOW_REGISTRATION or not has_users, "has_users": has_users}


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterBody, db: Session = Depends(get_db)) -> AuthResponse:
    user_count = db.scalar(select(func.count()).select_from(User)) or 0
    if user_count and not ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is closed. Ask an admin to create an account.")
    # The first account runs the place.
    user = create_account(db, body.username, body.email, body.password, is_admin=user_count == 0)
    record_sign_in(db, user)
    return _signed_in(user)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginBody, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    ip, account = client_ip(request), body.username.strip().lower()
    if wait := login_limiter.retry_after(ip, account):
        raise too_many_attempts(wait)

    user = db.scalar(select(User).where(func.lower(User.username) == account))
    valid = verify_password(body.password, user.hashed_password if user else _DUMMY_HASH)
    if not user or not valid:
        login_limiter.record_failure(ip, account)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password.")

    login_limiter.reset(ip, account)
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is disabled. Ask an admin to turn it back on.")
    record_sign_in(db, user)
    return _signed_in(user)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(require_user)) -> UserOut:
    return user_out(current_user)


@router.post("/change-password", response_model=AuthResponse)
def change_password(
    body: ChangePasswordBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> AuthResponse:
    """Signs out every other session and returns a fresh token for this one."""
    ip, account = client_ip(request), user.username.lower()
    if wait := login_limiter.retry_after(ip, account):
        raise too_many_attempts(wait)
    if not verify_password(body.current_password, user.hashed_password):
        login_limiter.record_failure(ip, account)
        # 400, not 401: the session itself is still valid.
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")

    login_limiter.reset(ip, account)
    set_password(user, body.new_password)
    db.commit()
    return _signed_in(user)
