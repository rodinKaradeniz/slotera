import { expect, test } from "@playwright/test";

test("production documents enforce script nonces including system pages", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(window, "cspViolations", []);
    document.addEventListener("securitypolicyviolation", (event) => {
      (Reflect.get(window, "cspViolations") as string[]).push(event.effectiveDirective);
    });
  });
  // Modify the parsed HTML: scripts inserted through a trusted debugger context
  // are not a meaningful test of nonce-based script injection protection.
  await page.route("**/*", async (route) => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace("</head>",
      "<script>window.untrustedSecurityProbe=true</script></head>");
    await route.fulfill({ response, body });
  });
  let previousPolicy: string | undefined;
  for (const path of ["/login", "/maintenance", "/missing-security-check"]) {
    const response = await page.goto(path);
    const policy = response?.headers()["content-security-policy"];
    expect(policy).toContain("'nonce-");
    expect(policy).not.toEqual(previousPolicy);
    previousPolicy = policy;
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "cspViolations")))
      .toEqual(["script-src-elem"]);
    expect(await page.evaluate(() => Reflect.get(window, "untrustedSecurityProbe"))).toBeUndefined();
    const nonces = await page.locator("script:not([src])").evaluateAll((scripts) => scripts
      .filter((script) => !script.textContent?.includes("untrustedSecurityProbe"))
      .map((script) => (script as HTMLScriptElement).nonce));
    expect(nonces.length).toBeGreaterThan(0);
    expect(nonces.every(Boolean)).toBe(true);
  }
});
