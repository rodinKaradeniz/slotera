"""Leased indexing jobs; source content is fetched only inside its tenant."""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import text

from slotera_api.ai.provider import Provider, create_provider
from slotera_api.ai.retrieval import source
from slotera_api.config import Settings, get_settings
from slotera_api.database import Database

logger = logging.getLogger("slotera.ai.worker")


async def process_one(database: Database, settings: Settings, provider: Provider) -> bool:
    async with database.transaction() as session:
        claimed = (
            (await session.execute(text("SELECT * FROM slotera_ai_claim()")))
            .mappings()
            .one_or_none()
        )
    if claimed is None:
        return False
    wid: UUID = claimed["workspace_id"]
    jid: UUID = claimed["id"]
    revision = 0
    try:
        async with database.tenant_transaction(wid) as session:
            job = (
                (
                    await session.execute(
                        text("SELECT * FROM ai_jobs WHERE workspace_id=:w AND id=:id"),
                        {"w": wid, "id": jid},
                    )
                )
                .mappings()
                .one_or_none()
            )
            if not job:
                return True
            revision = job["revision"]
            epoch = await session.scalar(
                text("SELECT privacy_epoch FROM ai_states WHERE workspace_id=:w AND enabled"),
                {"w": wid},
            )
            item = await source(session, wid, job["kind"], job["source_id"])
            if not item or not item["content"].strip() or epoch is None:
                await session.execute(
                    text("DELETE FROM ai_jobs WHERE workspace_id=:w AND id=:id AND revision=:r"),
                    {"w": wid, "id": jid, "r": revision},
                )
                return True
            content = str(item["title"]) + "\n" + str(item["content"])
            chunks = [
                content[start : start + 1200] for start in range(0, min(len(content), 24000), 1100)
            ]
            tokens = sum(len(chunk.encode()) for chunk in chunks)
            zone = await session.scalar(
                text("SELECT timezone FROM workspaces WHERE id=:w"), {"w": wid}
            )
            day = datetime.now(ZoneInfo(zone)).date()
            await session.execute(
                text(
                    "INSERT INTO ai_usage(workspace_id,day) VALUES(:w,:day) ON CONFLICT DO NOTHING"
                ),
                {"w": wid, "day": day},
            )
            reserved = await session.scalar(
                text(
                    "UPDATE ai_usage SET indexing_tokens=indexing_tokens+:n WHERE "
                    "workspace_id=:w AND day=:day AND indexing_tokens+:n<=:cap RETURNING "
                    "indexing_tokens"
                ),
                {"w": wid, "day": day, "n": tokens, "cap": settings.ai_daily_indexing_tokens},
            )
            if reserved is None:
                await session.execute(
                    text(
                        "UPDATE ai_jobs SET "
                        "claimed_at=NULL,attempts=greatest(attempts-1,0),due_at=:due WHERE "
                        "workspace_id=:w AND id=:id AND revision=:r"
                    ),
                    {
                        "w": wid,
                        "id": jid,
                        "r": revision,
                        "due": datetime.combine(
                            day + timedelta(days=1), datetime.min.time(), tzinfo=ZoneInfo(zone)
                        ),
                    },
                )
                return False
        embeddings = await provider.embed(chunks)
        async with database.tenant_transaction(wid, scheduling_write=True) as session:
            current = await session.scalar(
                text(
                    "SELECT j.id FROM ai_jobs j JOIN ai_states a ON "
                    "a.workspace_id=j.workspace_id JOIN workspaces w ON w.id=a.workspace_id"
                    " WHERE j.workspace_id=:w AND j.id=:id AND j.revision=:r AND a.enabled "
                    "AND a.privacy_epoch=:epoch AND w.operational_status='active' FOR UPDATE OF j"
                ),
                {"w": wid, "id": jid, "r": revision, "epoch": epoch},
            )
            if current:
                await session.execute(
                    text(
                        "DELETE FROM ai_documents WHERE workspace_id=:w AND kind=:kind AND "
                        "source_id=:source"
                    ),
                    {"w": wid, "kind": job["kind"], "source": job["source_id"]},
                )
                for position, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
                    await session.execute(
                        text(
                            "INSERT INTO "
                            "ai_documents(id,workspace_id,client_id,kind,source_id,position,title,content,href,embedding)"
                            " "
                            "VALUES(gen_random_uuid(),:w,:client,:kind,:source,:position,:title,:content,:href,CAST(:embedding"
                            " AS vector))"
                        ),
                        {
                            "w": wid,
                            "client": item["client_id"],
                            "kind": job["kind"],
                            "source": job["source_id"],
                            "position": position,
                            "title": str(item["title"])[:180]
                            + (" (excerpt)" if len(content) > 24000 else ""),
                            "content": chunk,
                            "href": item["href"],
                            "embedding": json.dumps(embedding),
                        },
                    )
                await session.execute(
                    text("DELETE FROM ai_jobs WHERE workspace_id=:w AND id=:id AND revision=:r"),
                    {"w": wid, "id": jid, "r": revision},
                )
        logger.info("ai_index_completed", extra={"workspace_id": str(wid), "resource_id": str(jid)})
    except Exception:
        async with database.tenant_transaction(wid) as session:
            await session.execute(
                text(
                    "UPDATE ai_jobs SET claimed_at=NULL,due_at=now()+interval '1 "
                    "minute'*power(2,least(attempts,5)) WHERE workspace_id=:w AND id=:id "
                    "AND revision=:r"
                ),
                {"w": wid, "id": jid, "r": revision},
            )
        logger.warning(
            "ai_index_failed",
            extra={
                "workspace_id": str(wid),
                "resource_id": str(jid),
                "error_code": "ai_index_failed",
            },
        )
    return True


async def run() -> None:
    settings = get_settings()
    database = Database(settings.database_url)
    try:
        while True:
            if settings.ai_provider == "disabled":
                await asyncio.sleep(5)
                continue
            processed = await process_one(database, settings, create_provider(settings))
            if not processed:
                await asyncio.sleep(2)
    finally:
        await database.dispose()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
