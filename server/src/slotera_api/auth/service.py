from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hmac import compare_digest
from typing import Literal, Protocol, cast
from uuid import UUID, uuid4

from slotera_api.auth.passwords import PasswordHasher, create_password_hasher
from slotera_api.auth.repository import AuthRepository, LoginIdentity, StoredAuthSession
from slotera_api.config import Settings
from slotera_api.database import Database
from slotera_api.identity import hash_opaque_token, issue_opaque_token, normalize_email

AuthRole = Literal["operator_admin", "superadmin"]


class InvalidCredentials(Exception):
    pass


class AccountUnavailable(Exception):
    pass


class WorkspaceSelectionRequired(Exception):
    pass


@dataclass(frozen=True)
class AuthSession:
    session_id: UUID
    user_id: UUID
    email: str
    title: str | None
    first_names: str
    last_name: str
    role: AuthRole
    workspace_id: UUID | None
    workspace_name: str | None
    workspace_slug: str | None
    csrf_token_hash: bytes
    expires_at: datetime


@dataclass(frozen=True)
class AuthResult:
    session: AuthSession
    session_token: str
    csrf_token: str


class AuthServiceProtocol(Protocol):
    async def login(
        self,
        *,
        email: str,
        password: str,
        remember_me: bool,
        workspace_id: UUID | None,
    ) -> AuthResult: ...

    async def authenticate(self, session_token: str) -> AuthSession | None: ...

    def csrf_matches(self, session: AuthSession, csrf_token: str) -> bool: ...

    async def revoke(self, session_token: str) -> None: ...


class AuthService:
    def __init__(
        self,
        *,
        repository: AuthRepository,
        password_hasher: PasswordHasher,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._password_hasher = password_hasher
        self._settings = settings
        self._dummy_password_hash = password_hasher.hash("slotera-invalid-credential-probe")

    async def login(
        self,
        *,
        email: str,
        password: str,
        remember_me: bool,
        workspace_id: UUID | None,
    ) -> AuthResult:
        identities = await self._repository.login_identities(normalize_email(email))
        password_hash = identities[0].password_hash if identities else None
        candidate_hash = password_hash or self._dummy_password_hash
        password_valid = self._password_hasher.verify(password, candidate_hash)
        if not identities or password_hash is None or not password_valid:
            raise InvalidCredentials

        selected = self._select_identity(identities, workspace_id)
        session_token = issue_opaque_token()
        csrf_token = issue_opaque_token()
        lifetime = (
            timedelta(days=self._settings.remembered_session_ttl_days)
            if remember_me
            else timedelta(hours=self._settings.session_ttl_hours)
        )
        expires_at = datetime.now(UTC) + lifetime
        created = await self._repository.create_session(
            session_id=uuid4(),
            user_id=selected.user_id,
            workspace_id=selected.workspace_id,
            token_hash=hash_opaque_token(session_token),
            csrf_token_hash=hash_opaque_token(csrf_token),
            expires_at=expires_at,
        )
        if not created:
            raise AccountUnavailable

        session = await self.authenticate(session_token)
        if session is None:
            raise AccountUnavailable
        return AuthResult(
            session=session,
            session_token=session_token,
            csrf_token=csrf_token,
        )

    async def authenticate(self, session_token: str) -> AuthSession | None:
        if not session_token:
            return None
        stored = await self._repository.session_for_token(hash_opaque_token(session_token))
        return self._to_auth_session(stored) if stored is not None else None

    def csrf_matches(self, session: AuthSession, csrf_token: str) -> bool:
        if not csrf_token:
            return False
        return compare_digest(
            session.csrf_token_hash,
            hash_opaque_token(csrf_token),
        )

    async def revoke(self, session_token: str) -> None:
        if session_token:
            await self._repository.revoke_session(hash_opaque_token(session_token))

    @staticmethod
    def _select_identity(
        identities: list[LoginIdentity], workspace_id: UUID | None
    ) -> LoginIdentity:
        first = identities[0]
        if first.platform_role == "superadmin":
            if workspace_id is not None:
                raise AccountUnavailable
            return first

        memberships = [identity for identity in identities if identity.workspace_id is not None]
        if workspace_id is not None:
            selected = next(
                (identity for identity in memberships if identity.workspace_id == workspace_id),
                None,
            )
            if selected is None:
                raise AccountUnavailable
            return selected
        if len(memberships) != 1:
            raise WorkspaceSelectionRequired
        return memberships[0]

    @staticmethod
    def _to_auth_session(stored: StoredAuthSession) -> AuthSession:
        if stored.role not in ("operator_admin", "superadmin"):
            raise AccountUnavailable
        return AuthSession(
            session_id=stored.session_id,
            user_id=stored.user_id,
            email=stored.email,
            title=stored.title,
            first_names=stored.first_names,
            last_name=stored.last_name,
            role=cast(AuthRole, stored.role),
            workspace_id=stored.workspace_id,
            workspace_name=stored.workspace_name,
            workspace_slug=stored.workspace_slug,
            csrf_token_hash=stored.csrf_token_hash,
            expires_at=stored.expires_at,
        )


def create_auth_service(database: Database, settings: Settings) -> AuthService:
    return AuthService(
        repository=AuthRepository(database),
        password_hasher=create_password_hasher(),
        settings=settings,
    )
