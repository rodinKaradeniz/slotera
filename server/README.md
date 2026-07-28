# Slotera API

Local FastAPI backend for Slotera. The portfolio/demo frontend remains mock-backed while
this service is developed independently.

## Prerequisites

- Python 3.13
- [uv](https://docs.astral.sh/uv/)
- Docker with Compose

## Setup

```bash
cp .env.example .env
uv sync
docker compose up -d db
uv run alembic upgrade head
uv run uvicorn slotera_api.main:app --reload --port 8000
```

The API documentation is available at `http://localhost:8000/docs`. Liveness is exposed
at `/health/live`; readiness, including PostgreSQL connectivity, is at `/health/ready`.
The local PostgreSQL service binds to `127.0.0.1:55432` to avoid colliding with other
projects that use the default host port.

## Checks

```bash
uv run pytest
uv run pytest -m integration
uv run ruff check .
uv run mypy
```

The integration test expects the local Compose database to be running. Migrations use the
owner connection; the application and readiness check use the restricted application
role.
