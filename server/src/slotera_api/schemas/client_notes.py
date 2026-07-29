from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import Field, model_validator
from pydantic.alias_generators import to_camel

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel


class ClientNoteCreate(StrictApiModel):
    title: Annotated[NonBlank, Field(max_length=160)]
    body: Annotated[NonBlank, Field(max_length=20000)]


class ClientNotePatch(StrictApiModel):
    title: Annotated[NonBlank | None, Field(max_length=160)] = None
    body: Annotated[NonBlank | None, Field(max_length=20000)] = None

    @model_validator(mode="after")
    def reject_empty_or_null_update(self) -> "ClientNotePatch":
        if not self.model_fields_set:
            raise ValueError("at least one field is required")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{to_camel(field)} cannot be null")
        return self


class ClientNoteResponse(ApiModel):
    id: UUID
    client_id: UUID
    title: str
    body: str
    created_at: datetime
    updated_at: datetime


class ClientNoteListResponse(ApiModel):
    items: list[ClientNoteResponse]
    total: int
