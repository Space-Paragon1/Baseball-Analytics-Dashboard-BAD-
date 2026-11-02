"""Request/response models. GameRecordIn holds every validation rule for a
box-score line, so CSV upload, manual entry and editing all behave the same."""

import re
from datetime import date, datetime
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from backend.services.innings import innings_to_outs, outs_to_innings

Count = Field(default=0, ge=0, le=999)

STAT_FIELDS = [
    "at_bats",
    "hits",
    "doubles",
    "triples",
    "home_runs",
    "runs",
    "rbi",
    "strikeouts",
    "walks",
    "hit_by_pitch",
    "sacrifice_flies",
    "innings_pitched",
    "earned_runs",
    "hits_allowed",
    "walks_allowed",
    "strikeouts_pitched",
    "home_runs_allowed",
    "hit_batsmen",
]
IDENTITY_FIELDS = ["player_name", "team", "position", "game_date", "game_id", "opponent"]


class GameRecordIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    player_id: Optional[int] = Field(default=None, ge=1)
    player_name: str = Field(min_length=1, max_length=100)
    team: str = Field(min_length=1, max_length=60)
    position: str = Field(min_length=1, max_length=10)
    game_date: date
    game_id: str = Field(min_length=1, max_length=40)
    opponent: str = Field(min_length=1, max_length=60)

    at_bats: int = Count
    hits: int = Count
    doubles: int = Count
    triples: int = Count
    home_runs: int = Count
    runs: int = Count
    rbi: int = Count
    strikeouts: int = Count
    walks: int = Count
    hit_by_pitch: int = Count
    sacrifice_flies: int = Count

    # Baseball notation: 6.1 = 6 1/3 innings, 6.2 = 6 2/3 innings.
    innings_pitched: Union[float, str] = 0
    earned_runs: int = Count
    hits_allowed: int = Count
    walks_allowed: int = Count
    strikeouts_pitched: int = Count
    home_runs_allowed: int = Count
    hit_batsmen: int = Count

    @field_validator("position")
    @classmethod
    def _upper_position(cls, v: str) -> str:
        return v.upper()

    @field_validator("innings_pitched")
    @classmethod
    def _valid_innings(cls, v: Union[float, str]) -> float:
        outs = innings_to_outs(v)  # raises ValueError with a helpful message
        if outs > 99 * 3:
            raise ValueError("innings_pitched is too large")
        return outs_to_innings(outs)

    @model_validator(mode="after")
    def _consistent(self) -> "GameRecordIn":
        problems = []
        if self.hits > self.at_bats:
            problems.append("hits cannot exceed at_bats")
        if self.doubles + self.triples + self.home_runs > self.hits:
            problems.append("doubles + triples + home_runs cannot exceed hits")
        if self.strikeouts > self.at_bats:
            problems.append("strikeouts cannot exceed at_bats")
        if self.home_runs_allowed > self.hits_allowed:
            problems.append("home_runs_allowed cannot exceed hits_allowed")
        if self.team.lower() == self.opponent.lower():
            problems.append("team and opponent must be different")
        if problems:
            raise ValueError("; ".join(problems))
        return self

    @property
    def outs_pitched(self) -> int:
        return innings_to_outs(self.innings_pitched)

    def db_fields(self) -> dict:
        """Column values for GameRecord (innings converted to outs)."""
        data = self.model_dump(exclude={"innings_pitched", "player_id"})
        data["outs_pitched"] = self.outs_pitched
        return data


class GameRecordOut(BaseModel):
    id: int
    player_id: int
    player_name: str
    team: str
    position: str
    game_date: date
    game_id: str
    opponent: str
    at_bats: int
    hits: int
    doubles: int
    triples: int
    home_runs: int
    runs: int
    rbi: int
    strikeouts: int
    walks: int
    hit_by_pitch: int
    sacrifice_flies: int
    innings_pitched: float
    earned_runs: int
    hits_allowed: int
    walks_allowed: int
    strikeouts_pitched: int
    home_runs_allowed: int
    hit_batsmen: int

    @classmethod
    def from_model(cls, r) -> "GameRecordOut":
        data = {c: getattr(r, c) for c in cls.model_fields if c != "innings_pitched"}
        data["innings_pitched"] = outs_to_innings(r.outs_pitched)
        return cls(**data)


class RecordPage(BaseModel):
    items: List[GameRecordOut]
    total: int
    page: int
    page_size: int


class ImportResult(BaseModel):
    success: bool = True
    message: str
    rows_loaded: int
    mode: Literal["replace", "append"]
    warnings: List[str] = []


# ---------------------------------------------------------------- auth & users

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")


def check_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes.")
    return v


class AccountFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str
    email: EmailStr

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        if not USERNAME_RE.match(v):
            raise ValueError("Username must be 3-32 characters: letters, numbers, dots, dashes or underscores.")
        return v


class RegisterBody(AccountFields):
    password: str

    _password = field_validator("password")(check_password)


class LoginBody(BaseModel):
    username: str
    password: str


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str

    _new_password = field_validator("new_password")(check_password)

    @model_validator(mode="after")
    def _different(self) -> "ChangePasswordBody":
        if self.new_password == self.current_password:
            raise ValueError("The new password must be different from the current one.")
        return self


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreateBody(AccountFields):
    """An account made by an admin. Leave out the password to generate a temporary one."""

    password: Optional[str] = None
    is_admin: bool = False

    @field_validator("password")
    @classmethod
    def _password(cls, v: Optional[str]) -> Optional[str]:
        return check_password(v) if v else None


class UserUpdateBody(BaseModel):
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class ManagedUserOut(UserOut):
    is_active: bool
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


class NewUserOut(BaseModel):
    user: ManagedUserOut
    # Only set when the server generated the password. It is shown once.
    temporary_password: Optional[str] = None


class PasswordResetOut(BaseModel):
    temporary_password: str
