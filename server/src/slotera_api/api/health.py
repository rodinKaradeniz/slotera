from http import HTTPStatus

from fastapi import APIRouter, Request

from slotera_api.database import DatabaseLifecycle
from slotera_api.errors import ApiError
from slotera_api.schemas.base import ErrorEnvelope, HealthResponse, ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", response_model=HealthResponse, operation_id="getLiveness")
async def liveness() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={HTTPStatus.SERVICE_UNAVAILABLE: {"model": ErrorEnvelope}},
    operation_id="getReadiness",
)
async def readiness(request: Request) -> ReadinessResponse:
    database: DatabaseLifecycle = request.app.state.database
    try:
        await database.healthcheck()
    except Exception as exc:
        raise ApiError(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            code="service_unavailable",
            message="Database readiness check failed",
        ) from exc
    return ReadinessResponse(status="ok", checks={"database": "ok"})
