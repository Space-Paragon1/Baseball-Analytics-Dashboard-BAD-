from backend.services.rate_limit import FailureLimiter, login_limiter
from backend.tests.conftest import bearer, register

PASSWORD = "correct-horse-battery"


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def make_limiter(clock):
    return FailureLimiter(max_per_account=3, max_per_ip=5, window_seconds=60, clock=clock)


def test_blocks_an_account_after_the_limit_and_unblocks_as_failures_age_out():
    clock = FakeClock()
    lim = make_limiter(clock)
    for _ in range(3):
        assert lim.retry_after("1.1.1.1", "alex") == 0
        lim.record_failure("1.1.1.1", "alex")
        clock.now += 10
    # Failures at t=1000, 1010, 1020; now t=1030. The oldest leaves the window at 1060.
    assert lim.retry_after("1.1.1.1", "alex") == 30
    clock.now = 1060
    assert lim.retry_after("1.1.1.1", "alex") == 0


def test_other_ips_and_accounts_are_not_blocked():
    clock = FakeClock()
    lim = make_limiter(clock)
    for _ in range(3):
        lim.record_failure("1.1.1.1", "alex")
    assert lim.retry_after("1.1.1.1", "alex") > 0
    assert lim.retry_after("2.2.2.2", "alex") == 0  # the owner, signing in from elsewhere
    assert lim.retry_after("1.1.1.1", "sam") == 0


def test_one_ip_is_capped_across_all_accounts():
    clock = FakeClock()
    lim = make_limiter(clock)
    for name in ["a", "b", "c", "d", "e"]:
        lim.record_failure("1.1.1.1", name)
    assert lim.retry_after("1.1.1.1", "brand-new-name") == 60


def test_reset_clears_only_that_account():
    clock = FakeClock()
    lim = make_limiter(clock)
    for _ in range(3):
        lim.record_failure("1.1.1.1", "alex")
    lim.reset("1.1.1.1", "alex")
    assert lim.retry_after("1.1.1.1", "alex") == 0
    for name in ["x", "y"]:
        lim.record_failure("1.1.1.1", name)
    assert lim.retry_after("1.1.1.1", "z") == 60  # the IP count wasn't reset


# ---------------------------------------------------------------- through the API


def _login(client, username, password):
    return client.post("/auth/login", json={"username": username, "password": password})


def test_login_is_blocked_after_repeated_failures_even_with_the_right_password(client):
    register(client, "alex")
    for _ in range(login_limiter.max_per_account):
        assert _login(client, "alex", "wrong-password").status_code == 401
    r = _login(client, "alex", PASSWORD)
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0
    assert "Try again in 15 minutes" in r.json()["detail"]


def test_username_case_does_not_dodge_the_limit(client):
    register(client, "alex")
    for name in ["alex", "ALEX", "Alex", " alex ", "aLeX"]:
        _login(client, name, "wrong-password")
    assert _login(client, "alex", PASSWORD).status_code == 429


def test_a_successful_login_resets_the_count(client):
    register(client, "alex")
    for _ in range(login_limiter.max_per_account - 1):
        _login(client, "alex", "wrong-password")
    assert _login(client, "alex", PASSWORD).status_code == 200
    for _ in range(login_limiter.max_per_account - 1):
        _login(client, "alex", "wrong-password")
    assert _login(client, "alex", PASSWORD).status_code == 200


def test_guessing_unknown_usernames_counts_too(client):
    for i in range(login_limiter.max_per_ip):
        _login(client, f"ghost{i}", "wrong-password")
    register(client, "alex")
    assert _login(client, "alex", PASSWORD).status_code == 429


def test_wrong_current_password_on_change_is_limited(client):
    token = register(client, "alex")["access_token"]
    body = {"current_password": "wrong-password", "new_password": "a-new-password"}
    for _ in range(login_limiter.max_per_account):
        r = client.post("/auth/change-password", json=body, headers=bearer(token))
        assert r.status_code == 400
    body["current_password"] = PASSWORD
    assert client.post("/auth/change-password", json=body, headers=bearer(token)).status_code == 429
