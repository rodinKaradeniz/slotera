# ruff: noqa: E501
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from slotera_api.schemas.base import ApiModel
from slotera_api.schemas.operator_resources import NonBlank, StrictApiModel


class FormFieldInput(StrictApiModel):
    id: NonBlank
    label: NonBlank
    type: Literal["short_text", "long_text", "single_select", "multi_select", "date", "yes_no", "consent_checkbox"]
    required: bool
    placeholder: str | None = Field(default=None, max_length=300)
    help_text: str | None = Field(default=None, max_length=500)
    options: list[NonBlank] | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_options(self) -> "FormFieldInput":
        selectable = self.type in {"single_select", "multi_select"}
        if selectable and not self.options:
            raise ValueError("select fields require options")
        if not selectable and self.options is not None:
            raise ValueError("only select fields support options")
        return self


class FormTemplateInput(StrictApiModel):
    name: NonBlank = Field(max_length=160)
    description: str = Field(default="", max_length=1000)
    status: Literal["active", "inactive"]
    fields: list[FormFieldInput] = Field(max_length=100)
    attached_service_ids: list[UUID] = Field(default_factory=list, max_length=100)
    required_before_payment: bool

    @model_validator(mode="after")
    def unique_ids(self) -> "FormTemplateInput":
        if len({field.id for field in self.fields}) != len(self.fields):
            raise ValueError("field ids must be unique")
        if len(set(self.attached_service_ids)) != len(self.attached_service_ids):
            raise ValueError("attachedServiceIds must be unique")
        return self


class FormTemplatePatch(StrictApiModel):
    name: NonBlank | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    status: Literal["active", "inactive"] | None = None
    fields: list[FormFieldInput] | None = Field(default=None, max_length=100)
    attached_service_ids: list[UUID] | None = Field(default=None, max_length=100)
    required_before_payment: bool | None = None


class FormTemplateResponse(ApiModel):
    id: UUID
    name: str
    description: str
    status: Literal["active", "inactive"]
    fields: list[FormFieldInput]
    attached_service_ids: list[UUID]
    required_before_payment: bool
    created_at: datetime


class FormTemplateListResponse(ApiModel):
    items: list[FormTemplateResponse]
    total: int
