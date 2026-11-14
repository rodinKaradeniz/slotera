import logging
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm.exc import StaleDataError
from starlette.exceptions import HTTPException

from slotera_api.schemas.base import ErrorBody, ErrorDetail, ErrorEnvelope

logger = logging.getLogger("slotera.errors")


class ApiError(Exception):
    def __init__(self, *, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def _request_id(request: Request) -> str:
    return str(request.state.request_id)


def _error_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
) -> JSONResponse:
    request.state.error_code = code
    request_id = _request_id(request)
    envelope = ErrorEnvelope(
        error=ErrorBody(
            code=code,
            message=message,
            request_id=request_id,
            details=details,
        )
    )
    return JSONResponse(
        status_code=status_code,
        content=envelope.model_dump(mode="json", by_alias=True, exclude_none=True),
        headers={"X-Request-ID": request_id},
    )


async def api_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, ApiError):
        raise TypeError("api_error_handler received an unexpected exception")
    return _error_response(
        request,
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, HTTPException):
        raise TypeError("http_exception_handler received an unexpected exception")
    message = exc.detail if isinstance(exc.detail, str) else HTTPStatus(exc.status_code).phrase
    code = "not_found" if exc.status_code == HTTPStatus.NOT_FOUND else "http_error"
    return _error_response(
        request,
        status_code=exc.status_code,
        code=code,
        message=message,
    )


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        raise TypeError("validation_error_handler received an unexpected exception")
    details = [
        ErrorDetail(
            location=list(error["loc"]),
            message=error["msg"],
            type=error["type"],
        )
        for error in exc.errors()
    ]
    return _error_response(
        request,
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        code="validation_error",
        message="Request validation failed",
        details=details,
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    context = getattr(request.state, "operation_context", None)
    logger.exception(
        "unhandled_request_error",
        exc_info=exc,
        extra={
            "request_id": _request_id(request),
            "error_code": "internal_error",
            "operation_id": context.operation_id if context else None,
            "actor_id": context.actor_id if context else None,
            "workspace_id": context.workspace_id if context else None,
        },
    )
    return _error_response(
        request,
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        code="internal_error",
        message="An unexpected error occurred",
    )


async def stale_edit_handler(request: Request, exc: Exception) -> JSONResponse:
    return _error_response(
        request,
        status_code=409,
        code="resource_stale",
        message=(
            "This item changed elsewhere. Your draft is kept; "
            "review the latest version before saving."
        ),
    )


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StaleDataError, stale_edit_handler)
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
