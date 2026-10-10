import httpx

from slotera_api.smoke import run_checks

API, APP, DEMO = "https://api.test", "https://app.test", "https://www.test"


def _handler(maintenance: bool) -> httpx.MockTransport:
    def handle(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if request.method == "OPTIONS":
            return httpx.Response(
                200,
                headers={
                    "access-control-allow-origin": APP,
                    "access-control-allow-credentials": "true",
                },
            )
        if url.startswith(APP) and maintenance:
            return httpx.Response(503)
        if url.endswith("/public/workspaces/lena/services"):
            return httpx.Response(200, json={"items": [{"id": "s1"}]})
        if "/availability" in url:
            return httpx.Response(200, json={"items": [{}, {}]})
        return httpx.Response(200)

    return httpx.MockTransport(handle)


async def test_all_checks_pass_on_a_healthy_stack() -> None:
    async with httpx.AsyncClient(transport=_handler(maintenance=False)) as client:
        results = await run_checks(client, api=API, app=APP, demo=DEMO, workspace="lena")
    assert all(result.ok for result in results), results
    assert results[-1].detail == "1 services, 2 slots next week"


async def test_maintenance_mode_fails_the_app_checks() -> None:
    async with httpx.AsyncClient(transport=_handler(maintenance=True)) as client:
        results = await run_checks(client, api=API, app=APP, demo=DEMO, workspace=None)
    failed = {result.name for result in results if not result.ok}
    assert failed == {"App home", "App terms page"}
