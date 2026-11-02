from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, true

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    # Disabled accounts can't sign in, and their existing sessions stop working.
    is_active = Column(Boolean, nullable=False, default=True, server_default=true())
    # Copied into every token. Bumping it signs the user out everywhere
    # (password change or reset, account disabled).
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    last_login_at = Column(DateTime(timezone=True), nullable=True)
