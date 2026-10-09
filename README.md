# Slotera

Slotera is a lightweight client workspace for independent consultants, coaches, instructors,
and small expert-led studios. It combines paid bookings, prep forms, session management,
client context, and a public booking page.

The default web application is a deterministic mock-backed portfolio demo. A separate,
opt-in local FastAPI + PostgreSQL mode implements the first real operator and public-booking
bundle without changing that default.

## Start locally

Prerequisites: Docker, [uv](https://docs.astral.sh/uv/), Node.js, and npm.

```bash
./scripts/dev          # mock-backed frontend + local API services
./scripts/dev --api    # frontend uses the local API bundle
```

The frontend runs on `http://localhost:3344`; the API runs on `http://localhost:8000`.

For product scope, architecture, local commands, and working conventions, start with
[AGENTS.md](AGENTS.md). Deployment topology and the live-release gate are documented in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
