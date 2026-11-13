from typing import Literal

from fastapi import APIRouter, Response
from sqlalchemy import text

from slotera_api.auth.dependencies import (
    AuthenticatedRequestDependency,
    CsrfProtectedRequestDependency,
    DatabaseDependency,
)
from slotera_api.identity import hash_opaque_token
from slotera_api.schemas.operator_resources import StrictApiModel

router = APIRouter(prefix="/auth/preferences", tags=["auth"])


class LanguagePreference(StrictApiModel):
    language: Literal["en", "tr", "de"]


@router.get("", response_model=LanguagePreference, operation_id="getLanguagePreference")
async def get_preference(
    response: Response, actor: AuthenticatedRequestDependency, database: DatabaseDependency
) -> LanguagePreference:
    async with database.transaction() as session:
        value = await session.scalar(
            text("SELECT public.slotera_auth_preferences(:token, NULL)"),
            {"token": hash_opaque_token(actor.session_token)},
        )
    response.headers["Cache-Control"] = "no-store"
    return LanguagePreference.model_validate({"language": value})


@router.patch("", response_model=LanguagePreference, operation_id="setLanguagePreference")
async def set_preference(
    payload: LanguagePreference,
    response: Response,
    actor: CsrfProtectedRequestDependency,
    database: DatabaseDependency,
) -> LanguagePreference:
    async with database.transaction() as session:
        await session.scalar(
            text("SELECT public.slotera_auth_preferences(:token, :language)"),
            {"token": hash_opaque_token(actor.session_token), "language": payload.language},
        )
    response.headers["Cache-Control"] = "no-store"
    return payload
