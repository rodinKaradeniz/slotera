import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { translate } from "../src/lib/i18n";

// The one end-to-end path through the real API, in the order a pilot week runs it: a client
// books on the public page, the operator signs in, approves the booking and moves it.
const api = "http://localhost:8011";
const origin = { Origin: "http://localhost:3345" };
const t = (key: Parameters<typeof translate>[1]) => translate("en", key);

async function headers(request: APIRequestContext) {
  const csrf = (await request.storageState()).cookies.find((cookie) => cookie.name === "slotera_csrf")?.value;
  return { ...origin, "X-CSRF-Token": csrf ?? "", "Idempotency-Key": crypto.randomUUID() };
}

/** A 30-minute start on `day` (days from now) at the first hour no other session covers. */
async function freeStart(request: APIRequestContext, day: number): Promise<Date> {
  const start = new Date();
  start.setDate(start.getDate() + day);
  const from = new Date(start); from.setUTCHours(0, 0, 0, 0);
  const until = new Date(+from + 86_400_000);
  const taken = (await (await request.get(`${api}/sessions?startsFrom=${from.toISOString()}&startsBefore=${until.toISOString()}&limit=500`)).json()).items;
  for (let hour = 9; hour < 21; hour++) {
    start.setUTCHours(hour, 0, 0, 0);
    const clash = taken.some((item: { status: string; startAt: string; endAt: string }) =>
      item.status !== "cancelled" && Date.parse(item.startAt) < +start + 30 * 60_000 && Date.parse(item.endAt) > +start);
    if (!clash) return start;
  }
  throw new Error("No free hour for the smoke session");
}

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    mkdirSync("browser-artifacts", { recursive: true });
    // Screen pixels contain synthetic UI only; no URL bar, network trace or DOM dump.
    await page.screenshot({ path: `browser-artifacts/${info.project.name}-${info.title.replace(/[^a-z0-9-]/gi, "-")}.png` });
  }
});

test("a client books, the operator signs in, approves and moves the booking", async ({ page, request }, info) => {
  await page.route((url) => url.hostname !== "localhost", (route) => route.abort());
  execFileSync(resolve("../server/.venv/bin/python"), [resolve("../server/scripts/browser_fixture.py"), "prepare-auth"], { stdio: "pipe" });

  info.annotations.push({ type: "phase", description: "setup" });
  // Setup runs in its own API context, so the browser page stays signed out until the form.
  const login = await request.post(`${api}/auth/login`, { headers: origin, data: { email: "hello@slotera.io", password: "slotera-local-only" } });
  expect(login.status()).toBe(200);
  expect((await request.patch(`${api}/auth/preferences`, { headers: await headers(request), data: { language: "en" } })).status()).toBe(200);
  const name = `Smoke approval ${info.project.name}`;
  const serviceResult = await request.post(`${api}/services`, { headers: await headers(request), data: {
    name, description: "Synthetic", durationMin: 30, priceCents: 0, bookingMode: "scheduled", capacity: 1,
    locationType: "online", location: name, confirmationPolicy: "operator_approval", active: true,
  } });
  expect(serviceResult.status()).toBe(201);
  const service = await serviceResult.json();
  // About six weeks out: past the 24-hour notice, inside the 90-day window, clear of the other journeys.
  const offset = info.project.name === "mobile" ? 44 : 40;
  const sessions = [];
  for (const day of [offset, offset + 1]) {
    const start = await freeStart(request, day);
    const result = await request.post(`${api}/sessions`, { headers: await headers(request), data: {
      serviceId: service.id, startAt: start.toISOString(), endAt: new Date(+start + 30 * 60_000).toISOString(),
      capacity: 1, locationType: "online", location: name,
    } });
    expect(result.status()).toBe(201);
    sessions.push(await result.json());
  }
  const [first, second] = sessions;

  info.annotations.push({ type: "phase", description: "public-booking" });
  await page.goto("/book/lena");
  await page.getByRole("heading", { name, exact: true }).click();
  await page.getByRole("button", { name: t("booking.continue"), exact: true }).click();
  const day = new Date(first.startAt);
  const today = new Date();
  for (let step = 0; step < (day.getFullYear() - today.getFullYear()) * 12 + day.getMonth() - today.getMonth(); step++) {
    await page.getByRole("button", { name: t("booking.datetime.nextMonth"), exact: true }).click();
  }
  await page.locator("button:enabled", { hasText: new RegExp(`^${day.getDate()}$`) }).click();
  await page.getByRole("button", { name: /^\d{2}:\d{2}/ }).click();
  await page.getByRole("button", { name: t("booking.continue"), exact: true }).click();
  const email = `smoke-${info.project.name}@example.com`;
  await page.getByRole("textbox", { name: t("booking.details.firstName") }).fill("Smoke");
  await page.getByRole("textbox", { name: t("booking.details.lastName") }).fill("Client");
  await page.getByRole("textbox", { name: t("booking.details.email") }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: t("booking.continue"), exact: true }).click();
  await page.getByRole("button", { name: t("booking.continue"), exact: true }).click();
  await page.getByRole("button", { name: t("booking.confirm"), exact: true }).click();
  await expect(page.getByRole("heading", { name: t("booking.confirm.pendingTitle") })).toBeVisible();
  const booked = (await (await request.get(`${api}/bookings?sessionId=${first.id}`)).json()).items;
  expect(booked).toHaveLength(1);
  const booking = booked[0];
  expect(booking).toMatchObject({ status: "pending", approvalStatus: "pending" });

  info.annotations.push({ type: "phase", description: "sign-in" });
  await page.goto("/login");
  await page.getByRole("textbox", { name: t("ui.email") }).fill("hello@slotera.io");
  await page.getByLabel(t("ui.password")).fill("slotera-local-only");
  await page.getByRole("button", { name: t("auth.login.submit"), exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  info.annotations.push({ type: "phase", description: "approve" });
  await page.goto(`/admin/bookings/${booking.id}`);
  await page.getByRole("button", { name: t("ui.approve.booking"), exact: true }).click();
  await page.getByRole("dialog", { name: t("ui.approve.this.booking") }).getByRole("button", { name: t("ui.approve"), exact: true }).click();
  await expect.poll(async () => (await (await request.get(`${api}/bookings/${booking.id}`)).json()).status).toBe("confirmed");
  await expect(page.getByRole("button", { name: t("ui.approve.booking"), exact: true })).toHaveCount(0);

  info.annotations.push({ type: "phase", description: "move" });
  await page.getByRole("button", { name: t("ui.move.to.another.session"), exact: true }).click();
  const move = page.getByRole("dialog", { name: t("ui.move.to.another.session") });
  await move.getByRole("combobox").selectOption(second.id);
  await move.getByRole("button", { name: t("ui.move.booking"), exact: true }).click();
  await expect(move).toBeHidden();
  const moved = await (await request.get(`${api}/bookings/${booking.id}`)).json();
  expect(moved).toMatchObject({ sessionId: second.id, status: "confirmed" });
  expect((await (await request.get(`${api}/bookings?sessionId=${first.id}`)).json()).items.filter((item: { status: string }) => item.status !== "cancelled")).toHaveLength(0);
});
