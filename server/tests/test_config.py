import pytest
from pydantic import ValidationError

from slotera_api.config import Settings


def test_cors_rejects_a_wildcard_origin() -> None:
    with pytest.raises(ValidationError):
        Settings(cors_origins=["*"])


def test_production_rejects_local_database_credentials() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production")
