from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import text

from slotera_api.database import Database


@dataclass(frozen=True)
class LoginIdentity:
    user_id: UUID
    email: str
    title: str | None
    first_names: str
    last_name: str
    password_hash: str | None
    platform_role: str | None
    workspace_id: UUID | None
    workspace_name: str | None
    workspace_slug: str | None
    membership_role: str | None


@dataclass(frozen=True)
class StoredAuthSession:
    session_id: UUID
    user_id: UUID
    email: str
    title: str | None
    first_names: str
    last_name: str
    role: str
    workspace_id: UUID | None
    workspace_name: str | None
    workspace_slug: str | None
    csrf_token_hash: bytes
    expires_at: datetime


class AuthRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    async def login_identities(self, email: str) -> list[LoginIdentity]:
        async with self._database.transaction() as session:
            rows = (
                await session.execute(
                    text("SELECT * FROM public.slotera_auth_login_identity(:email)"),
                    {"email": email},
                )
            ).mappings()
        return [LoginIdentity(**row) for row in rows]

    async def create_session(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        workspace_id: UUID | None,
        token_hash: bytes,
        csrf_token_hash: bytes,
        expires_at: datetime,
    ) -> bool:
        async with self._database.transaction() as session:
            created = await session.scalar(
                text(
                    """
                    SELECT public.slotera_auth_create_session(
                      :session_id,
                      :user_id,
                      :workspace_id,
                      :token_hash,
                      :csrf_token_hash,
                      :expires_at
                    )
                    """
                ),
                {
                    "session_id": session_id,
                    "user_id": user_id,
                    "workspace_id": workspace_id,
                    "token_hash": token_hash,
                    "csrf_token_hash": csrf_token_hash,
                    "expires_at": expires_at,
                },
            )
        return created is True

    async def session_for_token(self, token_hash: bytes) -> StoredAuthSession | None:
        async with self._database.transaction() as session:
            row = (
                await session.execute(
                    text("SELECT * FROM public.slotera_auth_session(:token_hash)"),
                    {"token_hash": token_hash},
                )
            ).mappings().one_or_none()
        return StoredAuthSession(**row) if row is not None else None

    async def revoke_session(self, token_hash: bytes) -> bool:
        async with self._database.transaction() as session:
            revoked = await session.scalar(
                text("SELECT public.slotera_auth_revoke_session(:token_hash)"),
                {"token_hash": token_hash},
            )
        return revoked is True
