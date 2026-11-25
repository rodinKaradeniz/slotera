import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadLang, translate, type Lang } from "../src/lib/i18n";
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
// Turkish and German load lazily; until loaded, translate() returns English.
test.beforeAll(() => Promise.all([loadLang("tr"), loadLang("de")]));

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
    await expect(page.getByRole("progressbar")).toHaveCount(1);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax","100");
    if (lang === "en") {
      await page.getByRole("progressbar").scrollIntoViewIfNeeded();
      mkdirSync("browser-artifacts", { recursive: true });
      await page.screenshot({path: `browser-artifacts/usage-${info.project.name}.png`});
    }
    fixture("index-ai");
    await page.goto("/admin/assistant");
    await expect(
      page.getByText(t("ai.simulated"), { exact: true }),
    ).toBeVisible();
    if (
      (await (await page.request.get(`${api}/ai/threads`)).json()).total === 0
    ) {
      if (info.project.name === "mobile") await page.getByRole("button", {name: t("chat.conversations"), exact: true}).click();
      await expect(
        page.getByText(t("ask.noChats"), { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: t("ask.title"), exact: true }),
      ).toBeVisible();
      if (info.project.name === "mobile") await page.getByRole("button", {name: t("chat.conversations"), exact: true}).click();
    }
    if(lang==="en"){mkdirSync("browser-artifacts",{recursive:true});await page.screenshot({path:`browser-artifacts/ask-empty-${info.project.name}.png`});}
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
    const conversation = (
      await (await page.request.get(`${api}/ai/threads`)).json()
    ).items[0];
    await page.reload();
    if (info.project.name === "mobile")
      await page
        .getByRole("button", { name: t("chat.conversations"), exact: true })
        .click();
    await page
      .locator(`[data-thread-id="${conversation.id}"]`)
      .getByRole("button", { name: conversation.title, exact: true })
      .click();
    await expect(
      page.getByText(`Add task ${title}`, { exact: true }),
    ).toHaveCount(1);
    const revised = `Synthetic revised ${info.project.name} ${lang}`;
    await page
      .getByRole("button", { name: t("chat.edit"), exact: true })
      .click();
    await page
      .getByRole("textbox", { name: t("ai.question"), exact: true })
      .fill(revised);
    await page.getByRole("button", { name: t("ai.send"), exact: true }).click();
    await expect(page.getByRole("button", { name: t("ai.send"), exact: true })).toBeVisible();
    await expect(page.getByText(revised, { exact: true })).toHaveCount(2);
    await expect(
      page.locator(`[data-thread-id="${conversation.id}"]`),
    ).toHaveCount(1);
    await expect(
      page.getByText(t("chat.disclaimer"), { exact: true }),
    ).toBeVisible();
    await expect(page.locator("p[aria-busy=true]")).toHaveCount(0);
    if (lang === "en") {
      mkdirSync("browser-artifacts", { recursive: true });
      await page.screenshot({
        path: `browser-artifacts/assistant-${info.project.name}.png`,
      });
    }
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/ai/threads/*/turns", async (route) => {
      await held;
      await route.continue();
    });
    try {
      await page
        .getByRole("textbox", { name: t("ai.question"), exact: true })
        .fill(`Synthetic stopped ${lang}`);
      await page
        .getByRole("button", { name: t("ai.send"), exact: true })
        .click();
      const cancelled = page.waitForResponse((response) =>
        response.url().endsWith("/stop"),
      );
      await page
        .getByRole("button", { name: t("chat.stop"), exact: true })
        .click();
      expect((await cancelled).status()).toBe(204);
    } finally {
      release();
    }
    await expect(
      page.getByText(t("chat.stopped"), { exact: true }),
    ).toBeVisible();
    await page.unroute("**/ai/threads/*/turns");
    await page.goto("/admin/dashboard");
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    // The workspace-wide daily brief was removed: the dashboard shows the next call only.
    await expect(page.getByText(t("dashboard.nextCall"), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: t("ai.briefMe"), exact: true })).toHaveCount(0);
    expect((await page.request.get(`${api}/ai/briefings/daily`)).status()).toBe(422);
    if (lang === "en") await page.screenshot({path: `browser-artifacts/today-${info.project.name}.png`});
    await page.goto("/admin/assistant");
    await page.getByRole("textbox", { name: t("ai.question"), exact: true }).fill(`Remove task ${title}`);
    await page.getByRole("button", { name: t("ai.send"), exact: true }).click();
    await expect(page.getByRole("heading", { name: t("ai.proposed"), exact: true })).toBeVisible();
    await page.getByRole("button", { name: t("ai.review"), exact: true }).click();
    await expect(page.getByRole("dialog").getByText(t("todo.removeEffect"), { exact: true })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: t("ai.confirm"), exact: true }).click();
    await expect(page.getByRole("button", { name: t("ai.executed"), exact: true })).toBeDisabled();
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("checkbox", { name: title, exact: true })).toHaveCount(0);
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
    await page.goto("/admin/assistant");
    if (info.project.name === "mobile")
      await page
        .getByRole("button", { name: t("chat.conversations"), exact: true })
        .click();
    await page
      .locator(`[data-thread-id="${conversation.id}"]`)
      .click({ button: "right" });
    await page
      .getByRole("menuitem", { name: t("ai.deleteChat"), exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: t("ui.cancel"), exact: true })
      .click();
    await expect(
      page.locator(`[data-thread-id="${conversation.id}"]`),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
