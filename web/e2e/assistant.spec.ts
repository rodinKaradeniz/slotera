import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { translate, type Lang } from "../src/lib/i18n";
const api = "http://localhost:8011";
const origin = { Origin: "http://localhost:3345" };
function fixture(mode: string) {
  return execFileSync(
    resolve("../server/.venv/bin/python"),
    [resolve("../server/scripts/browser_fixture.py"), mode],
    { stdio: "pipe" },
  );
}
async function headers(page: Page) {
  const csrf = (await page.context().cookies(api)).find(
    (c) => c.name === "slotera_csrf",
  );
  return { ...origin, "X-CSRF-Token": csrf?.value ?? "" };
}
for (const lang of ["en", "tr", "de"] as Lang[]) {
  test(`assistant answers, reviewed actions and briefings in ${lang}`, async ({
    page,
  }, info) => {
    fixture("prepare-auth");
    expect(
      (
        await page.request.post(`${api}/auth/login`, {
          headers: origin,
          data: { email: "hello@slotera.io", password: "slotera-local-only" },
        })
      ).status(),
    ).toBe(200);
    await page.request.patch(`${api}/auth/preferences`, {
      headers: await headers(page),
      data: { language: lang },
    });
    const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
    await page.route(
      (url) => url.hostname !== "localhost",
      (route) => route.abort(),
    );
    await page.goto("/admin/settings?section=ai");
    const status = await (await page.request.get(`${api}/ai/status`)).json();
    if (!status.enabled) {
      await page
        .getByRole("button", { name: t("ai.enable"), exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t("ai.confirm"), exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: t("ai.disable"), exact: true }),
      ).toBeVisible();
    }
    fixture("index-ai");
    await page.goto("/admin/assistant");
    await expect(
      page.getByText(t("ai.simulated"), { exact: true }),
    ).toBeVisible();
    const title = `Synthetic AI ${info.project.name} ${lang}`;
    await page
      .getByRole("textbox", { name: t("ai.question"), exact: true })
      .fill(`Add task ${title}`);
    await page.getByRole("button", { name: t("ai.send"), exact: true }).click();
    await expect(
      page.getByRole("heading", { name: t("ai.proposed"), exact: true }),
    ).toBeVisible();
    const before = await (await page.request.get(`${api}/tasks`)).json();
    expect(
      before.items.some((item: { title: string }) => item.title === title),
    ).toBe(false);
    await page
      .getByRole("button", { name: t("ai.review"), exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: t("ai.confirm"), exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: t("ai.executed"), exact: true }),
    ).toBeDisabled();
    await page.reload();
    await page
      .getByRole("button", { name: `Add task ${title}`, exact: true })
      .click();
    await expect(
      page.getByText(`Add task ${title}`, { exact: true }),
    ).toHaveCount(2);
    await page.goto("/admin/dashboard");
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: t("ai.briefMe"), exact: true })
        .or(page.getByRole("button", { name: t("ai.refresh"), exact: true })),
    ).toBeVisible();
    const cached = await (
      await page.request.get(`${api}/ai/briefings/daily`)
    ).json();
    if (!cached)
      await page
        .getByRole("button", { name: t("ai.briefMe"), exact: true })
        .click();
    await expect(
      page.getByRole("button", { name: t("ai.refresh"), exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: t("ai.refresh"), exact: true }),
    ).toBeVisible();
    const clients = await (
      await page.request.get(`${api}/clients?search=Sofia&limit=5`)
    ).json();
    await page.goto(`/admin/clients/${clients.items[0].id}`);
    await expect(
      page
        .getByRole("button", { name: t("ai.briefMe"), exact: true })
        .or(page.getByRole("button", { name: t("ai.refresh"), exact: true })),
    ).toBeVisible();
    const clientCached = await (
      await page.request.get(
        `${api}/ai/briefings/client?clientId=${clients.items[0].id}`,
      )
    ).json();
    if (!clientCached)
      await page
        .getByRole("button", { name: t("ai.briefMe"), exact: true })
        .click();
    await expect(
      page.getByRole("button", { name: t("ai.refresh"), exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
