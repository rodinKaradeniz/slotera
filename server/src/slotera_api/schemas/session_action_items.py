from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator
from pydantic.alias_generators import to_camel

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel


class SessionActionItemCreate(StrictApiModel):
    title: Annotated[NonBlank, Field(max_length=160)]
    description: Annotated[str | None, Field(max_length=1000)] = None
    due_date: date | None = None
    client_visible: bool = False


class SessionActionItemPatch(StrictApiModel):
    title: Annotated[NonBlank | None, Field(max_length=160)] = None
    description: Annotated[str | None, Field(max_length=1000)] = None
    status: Literal["todo", "done"] | None = None
    due_date: date | None = None
    client_visible: bool | None = None

    @model_validator(mode="after")
    def validate_patch(self) -> "SessionActionItemPatch":
        if not self.model_fields_set:
            raise ValueError("at least one field is required")
        for field in self.model_fields_set - {"description", "due_date"}:
            if getattr(self, field) is None:
                raise ValueError(f"{to_camel(field)} cannot be null")
        return self


class SessionActionItemResponse(ApiModel):
    id: UUID
    session_id: UUID
    title: str
    description: str | None
    status: Literal["todo", "done"]
    due_date: date | None
    client_visible: bool
    created_at: datetime
    updated_at: datetime


class SessionActionItemListResponse(ApiModel):
    items: list[SessionActionItemResponse]
    total: int
