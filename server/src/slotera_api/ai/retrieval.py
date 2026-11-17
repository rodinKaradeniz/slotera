"""Bounded current facts plus tenant-filtered lexical/vector retrieval."""

import json
import re
from datetime import UTC, datetime, time, timedelta
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.ai.help import HELP
from slotera_api.database import Database

SOURCES = (
    "client_notes",
    "conversation_messages",
    "booking_form_responses",
    "services",
    "service_packages",
    "sessions",
)


async def enqueue_all(session: AsyncSession, workspace: UUID) -> None:
    for table in SOURCES:
        await session.execute(
            text(
                "INSERT INTO ai_jobs(id,workspace_id,kind,source_id) "
                f"SELECT gen_random_uuid(),workspace_id,'{table}',id FROM {table} "
                "WHERE workspace_id=:w ON CONFLICT(workspace_id,kind,source_id) DO NOTHING"
            ),
            {"w": workspace},
        )
    for key in HELP:
        await session.execute(
            text(
                "INSERT INTO ai_jobs(id,workspace_id,kind,source_id) "
                "VALUES(gen_random_uuid(),:w,'help',:id) ON CONFLICT DO NOTHING"
            ),
            {"w": workspace, "id": uuid5(NAMESPACE_URL, "slotera-help:" + key)},
        )


async def source(
    session: AsyncSession, workspace: UUID, kind: str, identifier: UUID
) -> dict[str, Any] | None:
    if kind == "help":
        for key, (title, content, href) in HELP.items():
            if uuid5(NAMESPACE_URL, "slotera-help:" + key) == identifier:
                return {"title": title, "content": content, "href": href, "client_id": None}
        return None
    queries = {
        "client_notes": (
            "SELECT n.title,n.body AS content,c.id AS "
            "client_id,'/admin/clients/'||c.id AS href FROM client_notes n JOIN "
            "clients c ON c.id=n.client_id AND c.workspace_id=n.workspace_id WHERE "
            "n.workspace_id=:w AND n.id=:id AND c.erased_at IS NULL"
        ),
        "conversation_messages": (
            "SELECT c.name AS title,m.body AS content,c.id AS "
            "client_id,'/admin/clients/'||c.id||'?tab=messages' AS href FROM "
            "conversation_messages m JOIN clients c ON c.id=m.conversation_id AND "
            "c.workspace_id=m.workspace_id WHERE m.workspace_id=:w AND m.id=:id AND"
            " c.erased_at IS NULL"
        ),
        "booking_form_responses": (
            "SELECT f.name AS title, "
            "jsonb_build_object('questions',f.fields,'answers',r.answers)::text AS "
            "content,c.id AS client_id,'/admin/bookings/'||b.id AS href FROM "
            "booking_form_responses r JOIN bookings b ON "
            "b.workspace_id=r.workspace_id AND b.id=r.booking_id JOIN clients c ON "
            "c.workspace_id=b.workspace_id AND c.id=b.client_id JOIN "
            "booking_form_snapshots f ON f.workspace_id=r.workspace_id AND "
            "f.id=r.snapshot_id WHERE r.workspace_id=:w AND r.id=:id AND "
            "c.erased_at IS NULL"
        ),
        "services": (
            "SELECT name AS title,description||' '||coalesce(notes,'') AS "
            "content,NULL::uuid AS client_id,'/admin/services' AS href FROM "
            "services WHERE workspace_id=:w AND id=:id"
        ),
        "service_packages": (
            "SELECT name AS title,description||' '||coalesce(notes,'') AS "
            "content,NULL::uuid AS client_id,'/admin/packages' AS href FROM "
            "service_packages WHERE workspace_id=:w AND id=:id"
        ),
        "sessions": (
            "SELECT 'Session '||start_at AS title,coalesce(notes,'') AS "
            "content,NULL::uuid AS client_id,'/admin/calendar' AS href FROM "
            "sessions WHERE workspace_id=:w AND id=:id"
        ),
    }
    if kind not in queries:
        return None
    row = (
        (await session.execute(text(queries[kind]), {"w": workspace, "id": identifier}))
        .mappings()
        .one_or_none()
    )
    if row is None:
        return None
    result = dict(row)
    result["content"] = re.sub(r"<[^>]*>", " ", str(result["content"]))
    return result


async def facts(
    session: AsyncSession,
    workspace: UUID,
    prompt: str,
    client_id: UUID | None,
    timezone: str,
    actor: UUID | None = None,
) -> list[dict[str, Any]]:
    local = datetime.now(ZoneInfo(timezone))
    beginning = datetime.combine(local.date(), time.min, tzinfo=local.tzinfo)
    params: dict[str, Any] = {
        "w": workspace,
        "actor": f"operator:{actor}",
        "client": client_id,
        "start": beginning,
        "end": beginning + timedelta(days=2),
        "patterns": ["%" + token + "%" for token in re.findall(r"\w{3,}", prompt.lower())[:16]],
    }
    result: list[dict[str, Any]] = [
        {
            "id": "clock",
            "title": "Workspace time",
            "href": "/admin/calendar",
            "content": json.dumps(
                {
                    "asOf": datetime.now(UTC).isoformat(),
                    "localTime": local.isoformat(),
                    "timezone": timezone,
                    "coverage": "bounded record excerpts; totals are separate aggregate facts",
                }
            ),
        }
    ]
    queries = [
        (
            "unread",
            "Unread client conversations",
            "/admin/messages",
            "SELECT c.id,c.name,count(*) AS unread FROM conversation_messages m "
            "JOIN clients c ON c.workspace_id=m.workspace_id AND c.id=m.conversation_id "
            "LEFT JOIN conversation_reads r ON r.workspace_id=m.workspace_id "
            "AND r.conversation_id=m.conversation_id AND r.actor_key=:actor "
            "WHERE m.workspace_id=:w AND c.erased_at IS NULL AND m.sender_kind='client' "
            "AND m.sequence>coalesce(r.last_read,0) AND "
            "(CAST(:client AS uuid) IS NULL OR c.id=:client) "
            "GROUP BY c.id,c.name ORDER BY unread DESC,c.id LIMIT 25",
        ),
        (
            "totals",
            "Workspace totals",
            "/admin/dashboard",
            (
                "SELECT jsonb_build_object('clients',(SELECT count(*) FROM clients "
                "WHERE workspace_id=:w AND erased_at IS "
                "NULL),'bookingsByStatus',(SELECT jsonb_object_agg(status,n) FROM "
                "(SELECT status,count(*) n FROM bookings WHERE workspace_id=:w GROUP BY"
                " status) x),'openTasks',(SELECT count(*) FROM session_action_items "
                "WHERE workspace_id=:w AND status='todo')) AS facts"
            ),
        ),
        (
            "client",
            "Clients matching the request",
            "/admin/clients",
            (
                "SELECT id,name,email,phone,company,version FROM clients WHERE "
                "workspace_id=:w AND erased_at IS NULL AND ((CAST(:client AS uuid) IS "
                "NOT NULL AND id=:client) OR (CAST(:client AS uuid) IS NULL AND "
                "lower(name) LIKE ANY(CAST(:patterns AS text[])))) ORDER BY name,id "
                "LIMIT 12"
            ),
        ),
        (
            "service",
            "Service catalog",
            "/admin/services",
            (
                "SELECT "
                "id,name,version,price_cents,duration_min,active,booking_mode,capacity "
                "FROM services WHERE workspace_id=:w ORDER BY "
                "CASE WHEN lower(name) LIKE ANY(CAST(:patterns AS text[])) THEN 0 ELSE 1 END,"
                "name,id LIMIT 25"
            ),
        ),
        (
            "package",
            "Package offers",
            "/admin/packages",
            (
                "SELECT p.id,p.name,p.version,p.price_cents,p.status,(SELECT "
                "jsonb_agg(jsonb_build_object('serviceId',i.service_id,'position',i.position)"
                " ORDER BY i.position) FROM service_package_items i WHERE "
                "i.workspace_id=p.workspace_id AND i.package_id=p.id) AS items FROM "
                "service_packages p WHERE p.workspace_id=:w ORDER BY "
                "CASE WHEN lower(p.name) LIKE ANY(CAST(:patterns AS text[])) THEN 0 ELSE 1 END,"
                "p.name,p.id LIMIT "
                "15"
            ),
        ),
        (
            "session",
            "Sessions in the next two local calendar days",
            "/admin/calendar",
            (
                "SELECT "
                "id,service_id,start_at,end_at,capacity,location,location_type,status,version"
                " FROM sessions WHERE workspace_id=:w AND start_at<:end AND "
                "end_at>:start ORDER BY start_at,id LIMIT 25"
            ),
        ),
        (
            "booking",
            "Relevant bookings",
            "/admin/bookings",
            (
                "SELECT "
                "b.id,b.client_id,b.session_id,b.reference,b.status,b.payment_status,b.amount_cents,b.currency,s.start_at"
                " FROM bookings b JOIN sessions s ON s.workspace_id=b.workspace_id AND "
                "s.id=b.session_id JOIN clients c ON c.workspace_id=b.workspace_id AND "
                "c.id=b.client_id WHERE b.workspace_id=:w AND c.erased_at IS NULL AND "
                "((CAST(:client AS uuid) IS NOT NULL AND b.client_id=:client) OR "
                "(CAST(:client AS uuid) IS NULL AND (lower(c.name) LIKE "
                "ANY(CAST(:patterns AS text[])) OR (s.start_at<:end AND "
                "s.end_at>:start)))) ORDER BY s.start_at DESC,b.id LIMIT 25"
            ),
        ),
        (
            "task",
            "Open private tasks",
            "/admin/dashboard",
            (
                "SELECT id,title,status,due_date,session_id,version FROM "
                "session_action_items t WHERE workspace_id=:w AND status='todo' AND "
                "(CAST(:client AS uuid) IS NULL OR EXISTS(SELECT 1 FROM bookings b "
                "WHERE b.workspace_id=t.workspace_id AND b.session_id=t.session_id "
                "AND b.client_id=:client)) ORDER BY "
                "due_date NULLS LAST,id LIMIT 25"
            ),
        ),
    ]
    for kind, title, href, query in queries:
        rows = (await session.execute(text(query), params)).mappings().all()
        for index, row in enumerate(rows):
            identifier = str(row.get("id", index))
            path = href + "/" + identifier if kind in {"client", "booking"} else href
            result.append(
                {
                    "id": kind + ":" + identifier,
                    "title": title,
                    "href": path,
                    "content": json.dumps(dict(row), default=str, ensure_ascii=False),
                }
            )
    return result


async def retrieve(
    database: Database,
    workspace: UUID,
    prompt: str,
    vector: list[float] | None,
    category: str,
    client_id: UUID | None,
    timezone: str,
    actor: UUID | None = None,
) -> list[dict[str, Any]]:
    async with database.tenant_transaction(workspace, repeatable_read=True) as session:
        result = (
            await facts(session, workspace, prompt, client_id, timezone, actor)
            if category != "help"
            else []
        )
        params = {
            "w": workspace,
            "q": prompt[:2000],
            "v": json.dumps(vector) if vector else None,
            "client": client_id,
            "category": category,
        }
        # Exact cosine search is intentional at pilot scale: RLS/filtering precedes LIMIT.
        rows = (
            (
                await session.execute(
                    text("""
        WITH eligible AS MATERIALIZED (
          SELECT * FROM ai_documents WHERE workspace_id=:w
          AND ((:category='help' AND kind='help')
          OR (:category='workspace' AND kind<>'help')
          OR :category IN ('mixed','action','clarify'))
          AND (CAST(:client AS uuid) IS NULL OR client_id=:client OR kind='help')
        ), lexical AS (
          SELECT id,row_number() OVER(ORDER BY ts_rank_cd(to_tsvector('simple',content),
          plainto_tsquery('simple',:q)) DESC,id) r
          FROM eligible WHERE to_tsvector('simple',content) @@ plainto_tsquery('simple',:q)
          ORDER BY r,id LIMIT 30
        ), semantic AS (
          SELECT id,row_number() OVER(ORDER BY embedding <=> CAST(:v AS vector),id) r
          FROM eligible WHERE CAST(:v AS text) IS NOT NULL
          ORDER BY embedding <=> CAST(:v AS vector),id LIMIT 30
        ), fused AS (
          SELECT id,sum(1.0/(60+r)) score
          FROM (SELECT * FROM lexical UNION ALL SELECT * FROM semantic) x GROUP BY id
        ) SELECT d.id,d.title,d.href,d.content FROM fused f
          JOIN eligible d ON d.id=f.id ORDER BY score DESC,d.id LIMIT 8
        """),
                    params,
                )
            )
            .mappings()
            .all()
        )
        for row in rows:
            result.append({**dict(row), "id": str(row["id"])})
    # Reserve room for narrative evidence; complete SQL facts must not crowd it out.
    bounded = []
    sizes = {"facts": 0, "narrative": 0}
    for item in result:
        length = len(str(item["content"]).encode())
        narrative = ":" not in str(item["id"]) and item["id"] != "clock"
        bucket = "narrative" if narrative else "facts"
        limit = 6000 if narrative else 10000
        if sizes[bucket] + length <= limit:
            bounded.append(item)
            sizes[bucket] += length
    return bounded
