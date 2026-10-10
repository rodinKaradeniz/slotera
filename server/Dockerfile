# One image for the API, email worker, maintenance job and migrations; the compose
# service picks the command.
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.8.22 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-install-project
COPY alembic.ini ./
COPY migrations ./migrations
COPY src ./src
RUN uv sync --locked

RUN useradd --system --uid 10001 slotera
USER slotera
EXPOSE 8000
CMD ["uvicorn", "slotera_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-access-log"]
