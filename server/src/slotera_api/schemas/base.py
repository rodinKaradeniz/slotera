from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class ErrorDetail(ApiModel):
    location: list[str | int]
    message: str
    type: str


class ErrorBody(ApiModel):
    code: str
    message: str
    request_id: str
    details: list[ErrorDetail] | None = None


class ErrorEnvelope(ApiModel):
    error: ErrorBody


class HealthResponse(ApiModel):
    status: str


class ReadinessResponse(HealthResponse):
    checks: dict[str, str]


JsonObject = dict[str, Any]
