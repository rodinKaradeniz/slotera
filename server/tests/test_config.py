import pytest
from pydantic import ValidationError

from slotera_api.config import Settings


def test_cors_rejects_a_wildcard_origin() -> None:
    with pytest.raises(ValidationError):
        Settings(cors_origins=["*"])


def test_production_rejects_local_database_credentials() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production")


def test_production_requires_a_shared_csrf_cookie_domain() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            database_url="postgresql+asyncpg://app:secret@db/slotera",
            cors_origins=["https://app.slotera.app"],
        )
