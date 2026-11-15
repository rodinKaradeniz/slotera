import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import text

from slotera_api.config import get_settings
from slotera_api.database import Database

pytestmark = pytest.mark.integration


async def test_scheduling_writes_serialize_only_within_the_workspace() -> None:
    database = Database(get_settings().database_url)
    workspace_id, other_id = uuid4(), uuid4()
    started, acquired = asyncio.Event(), asyncio.Event()

    async def writer() -> None:
        started.set()
        async with database.tenant_transaction(workspace_id, scheduling_write=True):
            acquired.set()

    task = None
    try:
        async with database.tenant_transaction(workspace_id, scheduling_write=True):
            task = asyncio.create_task(writer())
            await asyncio.wait_for(started.wait(), 2)
            await asyncio.sleep(0.03)
            assert not acquired.is_set()
            async with asyncio.timeout(2):
                async with database.tenant_transaction(workspace_id) as session:
                    assert await session.scalar(text("SELECT 1")) == 1
                async with database.tenant_transaction(other_id, scheduling_write=True):
                    pass
        await asyncio.wait_for(task, 2)
        assert acquired.is_set()
    finally:
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        await database.dispose()
