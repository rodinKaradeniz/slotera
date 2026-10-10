"""Read-only launch smoke test against deployed hosts. It never writes anything.

    slotera-smoke --api https://api.slotera.app --app https://app.slotera.app \\
        --demo https://www.slotera.app [--workspace lena]

Prints one PASS/FAIL line per check and exits 1 if any check fails. The flows that need
an inbox (sign-up, reset, a booking's manage link) stay manual; see docs/DEPLOYMENT.md.
"""

import argparse
import asyncio
import sys
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import date, timedelta

import httpx


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool
    detail: str


def _expect(response: httpx.Response, status: int = 200) -> str:
    if response.status_code != status:
        raise AssertionError(f"HTTP {response.status_code}, expected {status}")
    return f"HTTP {response.status_code}"


async def run_checks(
    client: httpx.AsyncClient, *, api: str, app: str, demo: str, workspace: str | None
) -> list[CheckResult]:
    api, app, demo = api.rstrip("/"), app.rstrip("/"), demo.rstrip("/")
    results: list[CheckResult] = []

    async def check(name: str, run: Callable[[], Awaitable[str]]) -> None:
        try:
            results.append(CheckResult(name, True, await run()))
        except Exception as exc:  # each check reports its own failure
            results.append(CheckResult(name, False, str(exc) or type(exc).__name__))

    async def get(url: str) -> str:
        # 503 is the maintenance page, so a plain 200 also proves maintenance is off.
        return _expect(await client.get(url))

    async def cors() -> str:
        response = await client.options(
            f"{api}/auth/login",
            headers={"Origin": app, "Access-Control-Request-Method": "POST"},
        )
        allowed = response.headers.get("access-control-allow-origin")
        if allowed != app or response.headers.get("access-control-allow-credentials") != "true":
            raise AssertionError(f"origin {app} not allowed with credentials (got {allowed})")
        return "app origin allowed"

    await check("API ready", lambda: get(f"{api}/health/ready"))
    await check("App home", lambda: get(f"{app}/"))
    await check("Demo home", lambda: get(f"{demo}/"))
    await check("App terms page", lambda: get(f"{app}/terms"))
    await check("API CORS for the app", cors)

    if workspace:
        base = f"{api}/public/workspaces/{workspace}"

        async def availability() -> str:
            services = await client.get(f"{base}/services")
            _expect(services)
            items = services.json()["items"]
            if not items:
                raise AssertionError("the workspace has no active services")
            start = date.today() + timedelta(days=1)
            response = await client.get(
                f"{base}/services/{items[0]['id']}/availability",
                params={"from": start.isoformat(), "to": (start + timedelta(days=6)).isoformat()},
            )
            _expect(response)
            return f"{len(items)} services, {len(response.json()['items'])} slots next week"

        await check("Public workspace", lambda: get(base))
        await check("Public services and availability", availability)
    return results


async def _main(args: argparse.Namespace) -> int:
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        results = await run_checks(
            client, api=args.api, app=args.app, demo=args.demo, workspace=args.workspace
        )
    for result in results:
        print(f"{'PASS' if result.ok else 'FAIL'}  {result.name}: {result.detail}")
    return 0 if all(result.ok for result in results) else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only Slotera smoke test")
    parser.add_argument("--api", required=True, help="e.g. https://api.slotera.app")
    parser.add_argument("--app", required=True, help="e.g. https://app.slotera.app")
    parser.add_argument("--demo", required=True, help="e.g. https://www.slotera.app")
    parser.add_argument("--workspace", help="a live workspace slug to check public booking")
    sys.exit(asyncio.run(_main(parser.parse_args())))
