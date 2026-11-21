import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { translate } from "../src/lib/i18n";

// An operator records a package sale on a client, books one of its sessions from New
// booking, and gets the session back when that booking is cancelled.
const api = "http://localhost:8011";
const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate("en", key, vars);

async function headers(page: Page) {
  const csrf = (await page.context().cookies(api)).find((cookie) => cookie.name === "slotera_csrf")?.value;
  return { Origin: "http://localhost:3345", "X-CSRF-Token": csrf ?? "", "Idempotency-Key": crypto.randomUUID() };
}

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    mkdirSync("browser-artifacts", { recursive: true });
    // Screen pixels contain synthetic UI only; no URL bar, network trace or DOM dump.
    await page.screenshot({ path: `browser-artifacts/${info.project.name}-${info.title.replace(/[^a-z0-9-]/gi, "-")}.png` });
  }
});

test("a recorded package sale covers a booking and gets the session back on cancel", async ({ page }, info) => {
  await page.route((url) => url.hostname !== "localhost", (route) => route.abort());
  execFileSync(resolve("../server/.venv/bin/python"), [resolve("../server/scripts/browser_fixture.py"), "prepare-auth"], { stdio: "pipe" });
  const login = await page.request.post(`${api}/auth/login`, { headers: { Origin: "http://localhost:3345" }, data: { email: "hello@slotera.io", password: "slotera-local-only" } });
  expect(login.status()).toBe(200);
  expect((await page.request.patch(`${api}/auth/preferences`, { headers: await headers(page), data: { language: "en" } })).status()).toBe(200);

  info.annotations.push({ type: "phase", description: "setup" });
  const name = `Package ${info.project.name}`;
  const service = (await (await page.request.get(`${api}/services`)).json()).items.find((item: { name: string }) => item.name === "Discovery Call");
  const offer = await page.request.post(`${api}/packages`, { headers: await headers(page), data: {
    name, status: "active", priceCents: 40000, items: [{ serviceId: service.id }, { serviceId: service.id }],
  } });
  expect(offer.status()).toBe(201);
  const email = `package-${info.project.name}@example.com`;
  const client = await (await page.request.post(`${api}/clients`, { headers: await headers(page), data: { name: `Package client ${info.project.name}`, email } })).json();
  const start = new Date(); start.setDate(start.getDate() + (info.project.name === "mobile" ? 50 : 48)); start.setUTCHours(6, 0, 0, 0);
  const session = await page.request.post(`${api}/sessions`, { headers: await headers(page), data: {
    serviceId: service.id, startAt: start.toISOString(), endAt: new Date(+start + 30 * 60_000).toISOString(),
    capacity: 1, locationType: "online", location: name,
  } });
  expect(session.status()).toBe(201);
  const sessionId = (await session.json()).id;

  info.annotations.push({ type: "phase", description: "record-sale" });
  await page.goto(`/admin/clients/${client.id}`);
  await page.getByRole("button", { name: t("packageSales.record"), exact: true }).click();
  const sale = page.getByRole("dialog", { name: t("packageSales.recordTitle") });
  await sale.getByRole("combobox").selectOption((await offer.json()).id);
  await sale.getByRole("checkbox", { name: t("packageSales.paymentReceived") }).click();
  await sale.getByRole("button", { name: t("packageSales.record"), exact: true }).click();
  await expect(sale).toBeHidden();
  await expect(page.getByText(t("packageSales.used", { used: 0, total: 2 }))).toBeVisible();
  const purchase = (await (await page.request.get(`${api}/clients/${client.id}/package-purchases`)).json()).items[0];
  expect(purchase).toMatchObject({ packageName: name, paymentStatus: "paid", remainingCount: 2 });

  info.annotations.push({ type: "phase", description: "book-with-package" });
  await page.goto("/admin/bookings");
  await page.getByRole("button", { name: t("ui.new.booking"), exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("textbox", { name: t("booking.create.search") }).fill(email);
  // The second "Client" select picks the client; the first chooses existing or new.
  await drawer.getByRole("combobox", { name: /^Client/ }).nth(1).selectOption(client.id);
  await drawer.getByLabel(t("ui.session"), { exact: false }).selectOption(sessionId);
  await drawer.getByRole("combobox", { name: t("booking.package.use"), exact: true }).selectOption(purchase.id);
  const created = page.waitForResponse((response) => response.url() === `${api}/bookings` && response.request().method() === "POST");
  await drawer.getByRole("button", { name: t("ui.create.booking"), exact: true }).click();
  const booking = await (await created).json();
  expect(booking).toMatchObject({ paymentMethod: "package", amountCents: 0, status: "confirmed", packagePurchaseId: purchase.id });
  await expect(drawer).toBeHidden();

  info.annotations.push({ type: "phase", description: "credit-returns" });
  await page.goto(`/admin/bookings/${booking.id}`);
  await expect(page.getByText(t("booking.package.covered", { name, position: 1, total: 2 }))).toBeVisible();
  expect((await page.request.post(`${api}/bookings/${booking.id}/cancel`, { headers: await headers(page) })).status()).toBe(200);
  await page.goto(`/admin/clients/${client.id}`);
  await expect(page.getByText(t("packageSales.used", { used: 0, total: 2 }))).toBeVisible();
});
