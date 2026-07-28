from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slotera_api.api.health import router as health_router
from slotera_api.config import Settings, get_settings
from slotera_api.database import Database, DatabaseLifecycle
from slotera_api.errors import install_error_handlers
from slotera_api.logging import configure_logging
from slotera_api.middleware import request_context_middleware


def create_app(
    *,
    settings: Settings | None = None,
    database: DatabaseLifecycle | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    resolved_database = database or Database(resolved_settings.database_url)
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
    return app


app = create_app()
