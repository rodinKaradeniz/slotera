import asyncio

from slotera_api.auth.repository import AuthRepository
from slotera_api.config import get_settings
from slotera_api.database import Database
from slotera_api.logging import configure_logging


async def run() -> int:
    settings = get_settings()
    configure_logging(settings.log_level)
    database = Database(settings.database_url)
    try:
        return await AuthRepository(database).run_maintenance()
    finally:
        await database.dispose()


def main() -> None:
    asyncio.run(run())
