"""Creating accounts and changing their credentials. Shared by sign-up and the
admin Users page."""

import secrets
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models import GameSession, User
from backend.services.auth_service import hash_password


def create_account(db: Session, username: str, email: str, password: str, is_admin: bool = False) -> User:
    """Add a user, rejecting a taken username or email (case-insensitive) with a 409."""
    if db.scalar(select(User.id).where(func.lower(User.username) == username.lower())):
        raise HTTPException(status_code=409, detail="That username is taken.")
    if db.scalar(select(User.id).where(func.lower(User.email) == email.lower())):
        raise HTTPException(status_code=409, detail="That email is already registered.")

    user = User(username=username, email=email.lower(), hashed_password=hash_password(password), is_admin=is_admin)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # lost a race with another sign-up
        db.rollback()
        raise HTTPException(status_code=409, detail="That username or email is already registered.") from None
    db.refresh(user)
    return user


def temporary_password() -> str:
    """A random 16-character password for accounts an admin creates or resets."""
    return secrets.token_urlsafe(12)


def sign_out_everywhere(user: User) -> None:
    """Invalidate every token issued to this user so far."""
    user.token_version = (user.token_version or 0) + 1


def set_password(user: User, password: str) -> None:
    user.hashed_password = hash_password(password)
    sign_out_everywhere(user)


def record_sign_in(db: Session, user: User) -> None:
    user.last_login_at = datetime.now(UTC)
    db.commit()


def delete_account(db: Session, user: User) -> None:
    # Unfinished Game Mode games stay available; they just lose their creator.
    for game in db.scalars(select(GameSession).where(GameSession.created_by == user.id)):
        game.created_by = None
    db.delete(user)
    db.commit()
