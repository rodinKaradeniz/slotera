"""Operators' private calendar feeds: a secret link their calendar app subscribes to.

The link carries a random token (only its SHA-256 is stored); creating a new link
revokes the old one. The feed lists the workspace's sessions from 30 days ago to the
rolling horizon, with client names but never email addresses, phone numbers or notes.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import text

from slotera_api.calendar_ics import CalendarEvent
from slotera_api.database import Database
from slotera_api.db.models import CalendarFeedToken
from slotera_api.identity import hash_opaque_token, issue_opaque_token
from slotera_api.scheduling.recurrence import ROLLING_HORIZON_DAYS

FEED_PAST = timedelta(days=30)
FEED_MAX_EVENTS = 2000


def feed_path(token: str) -> str:
    return f"/calendar/feed/{token}.ics"


def redact_feed_path(path: str) -> str:
    """Logs and error reports must not carry the secret token."""
    return "/calendar/feed/[token].ics" if path.startswith("/calendar/feed/") else path


@dataclass(frozen=True)
class CalendarFeed:
    name: str
    events: list[CalendarEvent]


def _address_line(address: dict[str, Any] | None) -> str:
    if not address:
        return ""
    keys = ("street", "postal_code", "postalCode", "city")
    return ", ".join(str(address[key]) for key in keys if address.get(key))


def _summary(service_name: str, capacity: int, clients: list[str]) -> str:
    if capacity == 1:
        return f"{service_name} · {clients[0] if clients else 'open'}"
    return f"{service_name} · {len(clients)}/{capacity} booked"


class CalendarFeedRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def created_at(self, *, workspace_id: UUID, user_id: UUID) -> datetime | None:
        async with self.database.tenant_transaction(workspace_id) as session:
            created_at: datetime | None = await session.scalar(
                text(
                    "SELECT created_at FROM calendar_feed_tokens WHERE workspace_id = :w "
                    "AND user_id = :u AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1"
                ),
                {"w": workspace_id, "u": user_id},
            )
        return created_at

    async def _revoke(self, session: Any, workspace_id: UUID, user_id: UUID) -> int:
        result = await session.execute(
            text(
                "UPDATE calendar_feed_tokens SET revoked_at = now() WHERE workspace_id = :w "
                "AND user_id = :u AND revoked_at IS NULL"
            ),
            {"w": workspace_id, "u": user_id},
        )
        return int(result.rowcount or 0)

    async def rotate(self, *, workspace_id: UUID, user_id: UUID) -> str:
        """Revoke any live link and return a new token (shown to the operator once)."""
        token = issue_opaque_token()
        async with self.database.tenant_transaction(workspace_id) as session:
            await self._revoke(session, workspace_id, user_id)
            session.add(
                CalendarFeedToken(
                    workspace_id=workspace_id, user_id=user_id, token_hash=hash_opaque_token(token)
                )
            )
        return token

    async def revoke(self, *, workspace_id: UUID, user_id: UUID) -> bool:
        async with self.database.tenant_transaction(workspace_id) as session:
            return await self._revoke(session, workspace_id, user_id) > 0

    async def resolve(self, token: str) -> UUID | None:
        async with self.database.transaction() as session:
            workspace_id: UUID | None = await session.scalar(
                text("SELECT workspace_id FROM public.slotera_calendar_feed_resolve(:hash)"),
                {"hash": hash_opaque_token(token)},
            )
        return workspace_id

    async def feed(self, workspace_id: UUID, *, web_base_url: str) -> CalendarFeed:
        now = datetime.now(UTC)
        async with self.database.tenant_transaction(workspace_id) as session:
            name = await session.scalar(
                text(
                    "SELECT display_name FROM workspace_business_profiles WHERE workspace_id = :w"
                ),
                {"w": workspace_id},
            )
            rows = (
                await session.execute(
                    text(
                        """
                        SELECT s.id, s.start_at, s.end_at, s.capacity, s.location, s.address,
                               s.updated_at, svc.name AS service_name, svc.meeting_url,
                               coalesce(
                                 array_agg(
                                   coalesce(nullif(btrim(concat_ws(' ', b.customer_first_name,
                                                                   b.customer_last_name)), ''),
                                            'Client')
                                   ORDER BY b.created_at
                                 ) FILTER (WHERE b.id IS NOT NULL),
                                 '{}'
                               ) AS clients
                        FROM sessions AS s
                        JOIN services AS svc
                          ON svc.workspace_id = s.workspace_id AND svc.id = s.service_id
                        LEFT JOIN bookings AS b
                          ON b.workspace_id = s.workspace_id AND b.session_id = s.id
                         AND b.status::text <> 'cancelled'
                        WHERE s.workspace_id = :w
                          AND s.status::text <> 'cancelled'
                          AND s.start_at >= :since AND s.start_at < :until
                        GROUP BY s.id, svc.id
                        ORDER BY s.start_at
                        LIMIT :max
                        """
                    ),
                    {
                        "w": workspace_id,
                        "since": now - FEED_PAST,
                        "until": now + timedelta(days=ROLLING_HORIZON_DAYS),
                        "max": FEED_MAX_EVENTS,
                    },
                )
            ).mappings()
            events = [
                CalendarEvent(
                    uid=f"session-{row['id']}@slotera.io",
                    start=row["start_at"],
                    end=row["end_at"],
                    summary=_summary(row["service_name"], row["capacity"], list(row["clients"])),
                    location=row["meeting_url"]
                    or ", ".join(
                        part for part in (row["location"], _address_line(row["address"])) if part
                    ),
                    description=f"Open in Slotera: {web_base_url}/admin/calendar",
                    url=row["meeting_url"],
                    sequence=int(row["updated_at"].timestamp()),
                )
                for row in rows
            ]
        return CalendarFeed(name=f"Slotera · {name or 'Sessions'}", events=events)
