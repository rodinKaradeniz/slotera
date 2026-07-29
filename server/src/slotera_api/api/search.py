from typing import Annotated

from fastapi import APIRouter, Query, Response

from slotera_api.auth.dependencies import DatabaseDependency, OperatorWorkspaceDependency
from slotera_api.errors import ApiError
from slotera_api.schemas.search import SearchResponse, SearchResultResponse
from slotera_api.search.repository import SearchRepository

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse, operation_id="searchWorkspace")
async def search_workspace(
    response: Response,
    operator: OperatorWorkspaceDependency,
    database: DatabaseDependency,
    query: Annotated[str, Query(min_length=1, max_length=160)],
    limit_per_kind: Annotated[int, Query(alias="limitPerKind", ge=1, le=10)] = 6,
) -> SearchResponse:
    normalized_query = query.strip()
    if not normalized_query:
        raise ApiError(
            status_code=422,
            code="search_query_required",
            message="Search query must contain non-whitespace characters",
        )
    items = await SearchRepository(database).search(
        operator.workspace_id,
        query=normalized_query,
        limit_per_kind=limit_per_kind,
    )
    response.headers["Cache-Control"] = "no-store"
    return SearchResponse(
        query=normalized_query,
        limit_per_kind=limit_per_kind,
        items=[
            SearchResultResponse(
                kind=item.kind,
                id=item.id,
                title=item.title,
                subtitle=item.subtitle,
                occurred_at=item.occurred_at,
            )
            for item in items
        ],
    )
