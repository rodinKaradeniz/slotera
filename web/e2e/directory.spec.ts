import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { translate, type Lang } from "../src/lib/i18n";
for (const lang of ["en", "tr", "de"] as Lang[]) {
  test(`directory summaries and combined settings in ${lang}`, async ({page}, info) => {
    execFileSync(resolve("../server/.venv/bin/python"), [resolve("../server/scripts/browser_fixture.py"), "prepare-auth"], {stdio: "pipe"});
    const origin = {Origin: "http://localhost:3345"};
    expect((await page.request.post("http://localhost:8011/auth/login", {headers: origin, data: {email: "hello@slotera.io", password: "slotera-local-only"}})).status()).toBe(200);
    const csrf = (await page.context().cookies()).find(c => c.name === "slotera_csrf")!.value;
    await page.request.patch("http://localhost:8011/auth/preferences", {headers: {...origin, "X-CSRF-Token": csrf}, data: {language: lang}});
    for (const [path, kind] of [["services", "services"], ["forms", "forms"], ["packages", "packages"], ["clients", "clients"]] as const) {
      await page.goto(`/admin/${path}`);
      await expect(page.getByText(new RegExp(`\\d+ ${translate(lang, `counts.${kind}.many`, {count: ""}).trim()}`)).first()).toBeVisible();
    }
    await page.goto("/admin/settings?section=business");
    await expect(page.getByRole("heading", {name: translate(lang, "ui.branding"), exact: true})).toBeVisible();
    await expect(page.getByRole("button", {name: translate(lang, "ui.branding"), exact: true})).toHaveCount(0);
    if (lang === "en") { mkdirSync("browser-artifacts", {recursive: true}); await page.getByRole("heading", {name: translate(lang, "ui.branding"), exact: true}).scrollIntoViewIfNeeded(); await page.screenshot({path: `browser-artifacts/business-branding-${info.project.name}.png`}); }
    await page.locator("aside nav").getByRole("button", {name: translate(lang, "ui.notifications"), exact: true}).click();
    await expect(page.getByRole("heading", {name: translate(lang, "ui.notifications"), exact: true})).toBeVisible();
    if(lang === "en") await page.screenshot({path: `browser-artifacts/notifications-${info.project.name}.png`});
  });
}
