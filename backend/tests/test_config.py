from backend.config import normalize_database_url


def test_postgres_urls_use_the_installed_driver():
    assert normalize_database_url("postgres://u:p@host:5432/db") == "postgresql+psycopg://u:p@host:5432/db"
    assert normalize_database_url("postgresql://u:p@host/db") == "postgresql+psycopg://u:p@host/db"


def test_other_urls_are_left_alone():
    for url in ["sqlite:///baseball.db", "postgresql+psycopg2://u@host/db", "mysql://u@host/db"]:
        assert normalize_database_url(url) == url
