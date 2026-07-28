from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import cast

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slotera_api.api.auth import router as auth_router
from slotera_api.api.health import router as health_router
from slotera_api.api.notifications import router as notifications_router
from slotera_api.api.operator_resources import services_router, settings_router
from slotera_api.auth.service import AuthServiceProtocol, create_auth_service
from slotera_api.config import Settings, get_settings
from slotera_api.database import Database, DatabaseLifecycle
from slotera_api.errors import install_error_handlers
from slotera_api.logging import configure_logging
from slotera_api.middleware import request_context_middleware


def create_app(
    *,
    settings: Settings | None = None,
    database: DatabaseLifecycle | None = None,
    auth_service: AuthServiceProtocol | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    resolved_database = database or Database(resolved_settings.database_url)
    resolved_auth_service = auth_service or create_auth_service(
        cast(Database, resolved_database), resolved_settings
    )
    configure_logging(resolved_settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await resolved_database.dispose()

    app = FastAPI(
        title="Slotera API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.database = resolved_database
    app.state.settings = resolved_settings
    app.state.auth_service = resolved_auth_service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Authorization", "Content-Type", "X-CSRF-Token"],
    )
    app.middleware("http")(request_context_middleware)
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(notifications_router)
    app.include_router(settings_router)
    app.include_router(services_router)
    return app


app = create_app()
