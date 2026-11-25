import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { loadLang, translate, type Lang } from "../src/lib/i18n";

const api = "http://localhost:8011";
async function headers(page: Page) {
  const csrf = (await page.context().cookies(api)).find((cookie) => cookie.name === "slotera_csrf")?.value;
  return {Origin: "http://localhost:3345", "X-CSRF-Token": csrf ?? "", "Idempotency-Key": crypto.randomUUID()};
}
async function authenticate(page: Page, lang: Lang) {
  execFileSync(resolve("../server/.venv/bin/python"), [resolve("../server/scripts/browser_fixture.py"), "prepare-auth"], {stdio:"pipe"});
  const login = await page.request.post(`${api}/auth/login`, {headers: {Origin: "http://localhost:3345"}, data: {email: "hello@slotera.io", password: "slotera-local-only"}});
  expect(login.status()).toBe(200);
  const preference = await page.request.patch(`${api}/auth/preferences`, {headers: await headers(page), data: {language: lang}});
  expect(preference.status()).toBe(200);
}
async function reviewed(page: Page, id: string) {
  const current = await (await page.request.get(`${api}/sessions/${id}`)).json();
  const impact = await (await page.request.get(`${api}/sessions/${id}/change-preview`)).json();
  return {...await headers(page), "If-Match": `"v${current.version}"`, "X-Impact-Revision": impact.revision};
}

// Week steps from today to a date, by local Mondays as the calendar counts them. Using the
// day offset instead breaks when the local and UTC dates differ (after local midnight east of UTC).
function weeksAhead(date: Date) {
  const monday = (value: Date) => { const day = new Date(value); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (day.getDay() + 6) % 7); return day; };
  return Math.round((+monday(date) - +monday(new Date())) / (7 * 86400_000));
}

test.afterEach(async ({page}, info) => {
  if (info.status !== info.expectedStatus) {
    mkdirSync("browser-artifacts", {recursive: true});
    // Screen pixels contain synthetic UI only; no URL bar, network trace or DOM dump.
    await page.screenshot({path: `browser-artifacts/${info.project.name}-${info.title.replace(/[^a-z0-9-]/gi, "-")}.png`});
  }
});

// Turkish and German load lazily; until loaded, translate() returns English.
test.beforeAll(() => Promise.all([loadLang("tr"), loadLang("de")]));

for (const [index, lang] of (["en", "tr", "de"] as const).entries()) {
  test(`booking, forms, reviewed session changes and cancellation in ${lang}`, async ({page}, info) => {
    // Browser traffic is local-only, even if an integration is accidentally enabled.
    await page.route((url) => url.hostname !== "localhost", (route) => route.abort());
    const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
    info.annotations.push({type: "phase", description: "authentication"});
    await authenticate(page, lang);
    const catalog = await (await page.request.get(`${api}/services`)).json();
    const service = catalog.items.find((item: {name: string}) => item.name === "Discovery Call");
    const offset = index * 2 + (info.project.name === "mobile" ? 8 : 2);
    const start = new Date(); start.setDate(start.getDate() + offset); start.setUTCHours(12, 0, 0, 0);
    const dateStart = new Date(start); dateStart.setUTCHours(0, 0, 0, 0);
    const dateEnd = new Date(+dateStart + 86400_000);
    const occupied = await (await page.request.get(`${api}/sessions?startsFrom=${dateStart.toISOString()}&startsBefore=${dateEnd.toISOString()}&limit=500`)).json();
    for (let hour = 9; hour < 21; hour++) {
      start.setUTCHours(hour, 0, 0, 0);
      if (!occupied.items.some((item: {status: string; startAt: string; endAt: string}) => item.status !== "cancelled" && Date.parse(item.startAt) < +start + 30 * 60_000 && Date.parse(item.endAt) > +start)) break;
    }
    const location = `Browser ${info.project.name} ${lang}`;
    const sessionResult = await page.request.post(`${api}/sessions`, {headers: await headers(page), data: {
      serviceId: service.id, startAt: start.toISOString(), endAt: new Date(+start + 30 * 60_000).toISOString(),
      capacity: 2, locationType: "online", location,
    }});
    expect(sessionResult.status()).toBe(201);
    const session = await sessionResult.json();
    info.annotations.push({type: "phase", description: "booking"});
    await page.goto("/admin/bookings");
    await page.getByRole("button", {name: t("ui.new.booking"), exact: true}).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("combobox").first().selectOption("new");
    await drawer.locator('input[name="name"]').fill(`Browser client ${lang}`);
    await drawer.locator('input[name="email"]').fill(`browser-${info.project.name}-${lang}@example.com`);
    await drawer.getByLabel(t("ui.session"), {exact: false}).selectOption(session.id);
    const createdResponse = page.waitForResponse((response) => response.url() === `${api}/bookings` && response.request().method() === "POST");
    await drawer.getByRole("button", {name: t("ui.create.booking"), exact: true}).click();
    const created = await createdResponse;
    expect(created.status()).toBe(201);
    const booking = await created.json();
    await expect(drawer).toBeHidden();
    info.annotations.push({type: "phase", description: "details"});
    // Confirmed bookings are in a collapsed status group until explicitly opened.
    await page.getByRole("button", {name: new RegExp(`^${t("ui.confirmed")} ·`)}).click();
    await page.getByText(`Browser client ${lang}`, {exact: true}).first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/bookings/${booking.id}$`));
    await expect(page.getByRole("heading", {name: t("forms.answers"), exact: true})).toBeVisible();
    await expect(page.getByRole("button", {name: t("booking.emails.send"), exact: true})).toBeVisible();
    const metadata = await (await page.request.get(`${api}/bookings/${booking.id}/emails`)).json();
    expect(metadata.total).toBe(1);
    expect(metadata.items[0].simulated).toBe(true);
    expect(metadata.items[0].status).toBe("queued");
    expect(Object.keys(metadata.items[0])).not.toContain("templateData");

    info.annotations.push({type: "phase", description: "forms"});
    const helper = resolve("../server/scripts/browser_fixture.py");
    const link = JSON.parse(execFileSync(resolve("../server/.venv/bin/python"), [helper, "manage-link", booking.id], {encoding: "utf8"})).url as string;
    await page.goto(link);
    await page.getByRole("radio", {name: t("booking.field.no"), exact: true}).click();
    await page.getByRole("button", {name: t("forms.submit"), exact: true}).click();
    await expect(page.getByText(t("forms.corrections"), {exact: true})).toBeVisible();

    info.annotations.push({type: "phase", description: "session-change"});
    await page.goto("/admin/calendar");
    for (let step = 0; step < weeksAhead(start); step++) {
      await page.getByRole("button", {name: t("ui.next.period", {period: t("ui.week")}), exact: true}).click();
    }
    await page.getByRole("button", {name: new RegExp(location)}).click();
    await page.getByRole("button", {name: t("ui.edit.session"), exact: true}).click();
    const editor = page.getByRole("dialog", {name: `Session · ${session.id}`, exact: true});
    await editor.getByLabel(t("ui.meeting.location.detail"), {exact: true}).fill(`${location} changed`);
    // Another writer commits after the editor opened; review must preserve our draft.
    const competing = await page.request.patch(`${api}/sessions/${session.id}`, {headers: await reviewed(page, session.id), data: {capacity: 3}});
    expect(competing.status()).toBe(200);
    await editor.getByRole("button", {name: t("ui.save.changes"), exact: true}).click();
    const confirmation = page.getByRole("dialog", {name: t("session.reviewChange"), exact: true});
    await expect(confirmation).toContainText("3.");
    // Change attendance after review to exercise stale-preview recovery without discarding inputs.
    const second = await page.request.post(`${api}/bookings`, {headers: await headers(page), data: {newClient: {name: "Another synthetic client", email: `another-${info.project.name}-${lang}@example.com`}, sessionId: session.id, auditReason: "Browser concurrency check", sendEmail: false, language: lang}});
    expect(second.status()).toBe(201);
    await confirmation.getByRole("button", {name: t("ui.save.changes"), exact: true}).click();
    await expect(editor.getByLabel(t("ui.meeting.location.detail"), {exact: true})).toHaveValue(`${location} changed`);
    await editor.getByRole("button", {name: t("ui.save.changes"), exact: true}).click();
    await page.getByRole("dialog", {name: t("session.reviewChange"), exact: true}).getByRole("button", {name: t("ui.save.changes"), exact: true}).click();
    await expect(editor).toBeHidden();
    const changed = await (await page.request.get(`${api}/sessions/${session.id}`)).json();
    expect(changed.location).toBe(`${location} changed`);
    info.annotations.push({type: "phase", description: "session-cancel"});
    await page.getByRole("button", {name: new RegExp(`${location} changed`)}).click();
    await page.getByRole("button", {name: t("ui.edit.session"), exact: true}).click();
    await page.getByRole("button", {name: t("ui.cancel.session"), exact: true}).click();
    await page.getByRole("dialog", {name: t("ui.cancel.this.session"), exact: true}).getByRole("button", {name: t("ui.cancel.session"), exact: true}).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await (await page.request.get(`${api}/bookings/${booking.id}`)).json()).status).toBe("cancelled");
    info.annotations.push({type: "phase", description: "language"});
    await page.goto("/admin/settings");
    await page.getByRole("button", {name: t("ui.account"), exact: true}).click();
    const changedLanguage = lang === "en" ? "de" : "en";
    await page.getByRole("radio", {name: changedLanguage.toUpperCase(), exact: true}).click();
    await expect.poll(async () => (await (await page.request.get(`${api}/auth/preferences`)).json()).language).toBe(changedLanguage);
    await page.getByRole("radio", {name: lang.toUpperCase(), exact: true}).click();
    await expect.poll(async () => (await (await page.request.get(`${api}/auth/preferences`)).json()).language).toBe(lang);
    await page.reload();
    // The sidebar is collapsed on phones; the page heading shows the language on both layouts.
    await expect(page.getByRole("heading", {level: 1, name: t("ui.settings"), exact: true})).toBeVisible();
    expect((await (await page.request.get(`${api}/auth/preferences`)).json()).language).toBe(lang);
    const layout = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth}));
    expect(layout.scroll).toBeLessThanOrEqual(layout.width);
  });
}

test("recurring scope retains dates and stops following sessions", async ({page}, info) => {
  info.annotations.push({type: "phase", description: "recurring"});
  await page.route((url) => url.hostname !== "localhost", (route) => route.abort());
  await authenticate(page, "en");
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate("en", key, vars);
  const service = (await (await page.request.get(`${api}/services`)).json()).items.find((item: {name: string}) => item.name === "Discovery Call");
  const offset = info.project.name === "desktop" ? 16 : 18;
  const first = new Date(); first.setDate(first.getDate() + offset); first.setUTCHours(9, 0, 0, 0);
  const end = new Date(+first + 15 * 86400_000);
  const occupied = (await (await page.request.get(`${api}/sessions?startsFrom=${first.toISOString()}&startsBefore=${end.toISOString()}&limit=500`)).json()).items;
  for (let hour = 9; hour < 21; hour++) {
    first.setUTCHours(hour, 0, 0, 0);
    if (![0, 7, 14].some((day) => occupied.some((item: {status: string; startAt: string; endAt: string}) => item.status !== "cancelled" && Date.parse(item.startAt) < +first + day * 86400_000 + 30 * 60_000 && Date.parse(item.endAt) > +first + day * 86400_000))) break;
  }
  const location = `Recurring ${info.project.name}`;
  const result = await page.request.post(`${api}/sessions`, {headers: await headers(page), data: {
    serviceId: service.id, startAt: first.toISOString(), endAt: new Date(+first + 30 * 60_000).toISOString(),
    capacity: 2, locationType: "online", location,
    recurrence: {intervalWeeks: 1, weekdays: [first.getUTCDay() || 7], endsOn: new Date(+first + 14 * 86400_000).toISOString().slice(0, 10)},
  }});
  expect(result.status()).toBe(201);
  const item = await result.json();
  const original = (await (await page.request.get(`${api}/sessions?seriesId=${item.seriesId}`)).json()).items;
  expect(original).toHaveLength(3);
  await page.goto("/admin/calendar");
  for (let step = 0; step < weeksAhead(first); step++) {
    await page.getByRole("button", {name: t("ui.next.period", {period: t("ui.week")}), exact: true}).click();
  }
  await page.getByRole("button", {name: new RegExp(location)}).click();
  await page.getByRole("button", {name: t("ui.edit.session"), exact: true}).click();
  const editor = page.getByRole("dialog", {name: `Session · ${item.id}`, exact: true});
  await editor.getByLabel(t("session.changeScope"), {exact: false}).selectOption("this_and_following");
  await expect(editor.locator('input[type="date"]')).toBeDisabled();
  await editor.getByLabel(t("ui.meeting.location.detail"), {exact: true}).fill(`${location} changed`);
  await editor.getByRole("button", {name: t("ui.save.changes"), exact: true}).click();
  const review = page.getByRole("dialog", {name: t("session.reviewChange"), exact: true});
  await expect(review).toContainText("3 sessions");
  await review.getByRole("button", {name: t("ui.save.changes"), exact: true}).click();
  await expect(editor).toBeHidden();
  const changed = (await (await page.request.get(`${api}/sessions?seriesId=${item.seriesId}`)).json()).items;
  expect(changed.map((entry: {startAt: string}) => entry.startAt)).toEqual(original.map((entry: {startAt: string}) => entry.startAt));
  expect(changed.every((entry: {location: string}) => entry.location === `${location} changed`)).toBe(true);
  await page.getByRole("button", {name: new RegExp(`${location} changed`)}).click();
  await page.getByRole("button", {name: t("ui.edit.session"), exact: true}).click();
  await editor.getByLabel(t("session.changeScope"), {exact: false}).selectOption("this_and_following");
  await editor.getByRole("button", {name: t("ui.cancel.session"), exact: true}).click();
  await page.getByRole("dialog", {name: t("ui.cancel.this.session"), exact: true}).getByRole("button", {name: t("ui.cancel.session"), exact: true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const cancelled = (await (await page.request.get(`${api}/sessions?seriesId=${item.seriesId}`)).json()).items;
  expect(cancelled.every((entry: {status: string}) => entry.status === "cancelled")).toBe(true);
});
