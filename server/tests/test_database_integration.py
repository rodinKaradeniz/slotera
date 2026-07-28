import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from slotera_api.config import get_settings
from slotera_api.database import Database
from slotera_api.main import create_app


@pytest.mark.integration
async def test_application_role_can_reach_postgres() -> None:
    database = Database(get_settings().database_url)

    try:
        app = create_app(database=database)
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get("/health/ready")
    finally:
        await database.dispose()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"database": "ok"}}


@pytest.mark.integration
async def test_application_role_cannot_create_tables() -> None:
    database = Database(get_settings().database_url)

    try:
        async with database.engine.connect() as connection:
            with pytest.raises(ProgrammingError):
                await connection.execute(text("CREATE TABLE restricted_role_probe (id integer)"))
    finally:
        await database.dispose()
