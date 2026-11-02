"""Slows down password guessing by counting failed attempts.

Two limits, each over a sliding window:
  - per account from one client IP (LOGIN_MAX_ATTEMPTS). Someone guessing at an
    account gets blocked, but can't lock the real owner out from elsewhere.
  - per client IP across all accounts (4x that), so one client can't work
    through a list of usernames.
A correct password clears that account's count for that IP.

Counts are kept in memory: they reset when the API restarts and are per
process. That suits the single-process setup this app ships with; a multi-server
deployment would move this to a shared store such as Redis.
"""

import math
import threading
import time
from collections import deque
from typing import Callable, Optional

from fastapi import HTTPException, Request, status

from backend.config import LOGIN_LOCKOUT_MINUTES, LOGIN_MAX_ATTEMPTS

_PRUNE_AT = 10_000  # tracked keys before expired ones are swept


class FailureLimiter:
    def __init__(
        self,
        max_per_account: int,
        max_per_ip: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.max_per_account = max_per_account
        self.max_per_ip = max_per_ip
        self.window = window_seconds
        self.clock = clock
        self._failures: dict[tuple[str, Optional[str]], deque] = {}
        self._lock = threading.Lock()

    def _recent(self, key, now: float) -> deque:
        q = self._failures.get(key)
        if q is None:
            return deque()
        while q and q[0] <= now - self.window:
            q.popleft()
        if not q:
            del self._failures[key]
        return q

    def retry_after(self, ip: str, account: str) -> int:
        """Seconds until this client may try this account again (0 = now)."""
        now = self.clock()
        waits = []
        with self._lock:
            for key, limit in (((ip, account), self.max_per_account), ((ip, None), self.max_per_ip)):
                q = self._recent(key, now)
                if len(q) >= limit:
                    # Blocked until enough of the oldest failures leave the window.
                    waits.append(q[len(q) - limit] + self.window - now)
        return math.ceil(max(waits)) if waits else 0

    def record_failure(self, ip: str, account: str) -> None:
        now = self.clock()
        with self._lock:
            for key in ((ip, account), (ip, None)):
                self._failures.setdefault(key, deque()).append(now)
            if len(self._failures) > _PRUNE_AT:
                for key in list(self._failures):
                    self._recent(key, now)

    def reset(self, ip: str, account: str) -> None:
        with self._lock:
            self._failures.pop((ip, account), None)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()


login_limiter = FailureLimiter(
    max_per_account=LOGIN_MAX_ATTEMPTS,
    max_per_ip=LOGIN_MAX_ATTEMPTS * 4,
    window_seconds=LOGIN_LOCKOUT_MINUTES * 60,
)


def client_ip(request: Request) -> str:
    # Behind a reverse proxy this is the proxy's address unless uvicorn trusts
    # it (FORWARDED_ALLOW_IPS); see the deployment notes in the README.
    return request.client.host if request.client else "unknown"


def too_many_attempts(retry_after: int) -> HTTPException:
    minutes = max(1, math.ceil(retry_after / 60))
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many failed attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
        headers={"Retry-After": str(retry_after)},
    )
