"""Admin-only user management.

Admins can't change, reset or delete their own account here. That also
guarantees there's always at least one active admin.
"""

from datetime import UTC, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import ManagedUserOut, NewUserOut, PasswordResetOut, UserCreateBody, UserUpdateBody
from backend.services.accounts import (
    create_account,
    delete_account,
    set_password,
    sign_out_everywhere,
    temporary_password,
)
from backend.services.auth_service import require_admin

router = APIRouter(prefix="/users", tags=["Users"])


def _utc(value: Optional[datetime]) -> Optional[datetime]:
    """Always answer in UTC. SQLite hands back naive datetimes (stored in UTC);
    PostgreSQL answers in the server's time zone."""
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _managed(user: User) -> ManagedUserOut:
    return ManagedUserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        is_admin=bool(user.is_admin),
        is_active=bool(user.is_active),
        created_at=_utc(user.created_at),
        last_login_at=_utc(user.last_login_at),
    )


def _other_user(db: Session, user_id: int, admin: User, action: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail=f"You can't {action} your own account here.")
    return user


@router.get("", response_model=List[ManagedUserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> List[ManagedUserOut]:
    return [_managed(u) for u in db.scalars(select(User).order_by(User.id))]


@router.post("", response_model=NewUserOut, status_code=status.HTTP_201_CREATED)
def add_user(body: UserCreateBody, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> NewUserOut:
    """Works even when public sign-up is closed."""
    generated = None if body.password else temporary_password()
    user = create_account(db, body.username, body.email, body.password or generated, is_admin=body.is_admin)
    return NewUserOut(user=_managed(user), temporary_password=generated)


@router.patch("/{user_id}", response_model=ManagedUserOut)
def update_user(
    user_id: int, body: UserUpdateBody, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> ManagedUserOut:
    user = _other_user(db, user_id, admin, "change")
    if body.is_admin is not None:
        user.is_admin = body.is_admin  # roles are read on every request, so this applies at once
    if body.is_active is not None and body.is_active != user.is_active:
        user.is_active = body.is_active
        if not body.is_active:
            sign_out_everywhere(user)
    db.commit()
    return _managed(user)


@router.post("/{user_id}/reset-password", response_model=PasswordResetOut)
def reset_password(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Sets a temporary password and signs the user out everywhere."""
    user = _other_user(db, user_id, admin, "reset")
    password = temporary_password()
    set_password(user, password)
    db.commit()
    return PasswordResetOut(temporary_password=password)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> Response:
    delete_account(db, _other_user(db, user_id, admin, "delete"))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
