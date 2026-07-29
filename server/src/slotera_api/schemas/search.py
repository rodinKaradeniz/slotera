from datetime import datetime
from typing import Literal
from uuid import UUID

from slotera_api.schemas.base import ApiModel


class SearchResultResponse(ApiModel):
    kind: Literal["booking", "client", "service", "session"]
    id: UUID
    title: str
    subtitle: str | None
    occurred_at: datetime | None


class SearchResponse(ApiModel):
    query: str
    items: list[SearchResultResponse]
    limit_per_kind: int
