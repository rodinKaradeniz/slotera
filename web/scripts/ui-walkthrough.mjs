// Visual walkthrough of the mock app for design review: every operator route, overlays
// caught mid-animation, phone widths and a Reduce Motion pass.
//   npm run build && npm run start   (mock mode, port 3344)
//   npm run ui:walk                  (screenshots land in web/ui-shots/, gitignored)
// It also refreshes the landing hero images in web/src/assets/landing/ (2x, committed).
// UI_WALK_BASE and UI_WALK_OUT override the target and the output folder.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.UI_WALK_OUT || path.join(here, "..", "ui-shots");
const BASE = process.env.UI_WALK_BASE || "http://127.0.0.1:3344";
const HERO = path.join(here, "..", "src", "assets", "landing");
mkdirSync(OUT, { recursive: true });

const settle = (p, ms = 900) => p.waitForTimeout(ms);
async function shot(page, name, full = true) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("shot", name);
}
async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "hello@slotera.io");
  await page.fill('input[type="password"]', "demo-password");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
}
async function step(label, fn) {
  try { await fn(); } catch (e) { console.log("skip", label, "-", e.message.split("\n")[0]); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));

  // Public
  for (const [name, path] of [["login", "/login"], ["booking", "/booking"], ["manage-demo", "/booking/manage/demo"]]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await settle(page);
    await shot(page, name);
  }
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await settle(page);
  // The demo guide opens once per session and locks scrolling; close it first.
  await page.keyboard.press("Escape");
  await settle(page, 400);
  await shot(page, "landing-top", false);
  await page.evaluate(() => window.scrollTo(0, 1800));
  await page.waitForTimeout(300);
  await shot(page, "anim-landing-reveal-300ms", false);
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(150); }
  await settle(page, 1500);
  await shot(page, "landing-full");

  // Operator app, first visits (entrance plays) with a mid-entrance frame on the dashboard
  await login(page);
  await page.waitForTimeout(150);
  await shot(page, "anim-dashboard-150ms", false);
  await settle(page, 1200);
  await shot(page, "admin-dashboard");
  for (const r of ["calendar", "bookings", "clients", "services", "packages", "forms", "settings", "messages", "assistant"]) {
    await step(r, async () => {
      await page.goto(`${BASE}/admin/${r}`, { waitUntil: "networkidle" });
      await settle(page);
      await shot(page, `admin-${r}`);
    });
  }
  await step("booking detail", async () => {
    await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
    const href = await page.locator('a[href^="/admin/bookings/"]').first().getAttribute("href");
    await page.goto(BASE + href, { waitUntil: "networkidle" });
    await settle(page);
    await shot(page, "admin-booking-detail");
  });
  await step("client detail + tab slide", async () => {
    await page.goto(`${BASE}/admin/clients`, { waitUntil: "networkidle" });
    const href = await page.locator('a[href^="/admin/clients/"]').first().getAttribute("href");
    await page.goto(BASE + href, { waitUntil: "networkidle" });
    await settle(page);
    await shot(page, "admin-client-detail");
    await page.getByRole("tab", { name: /notes/i }).first().click();
    await page.waitForTimeout(90);
    await shot(page, "anim-tab-90ms", false);
    await settle(page);
    await shot(page, "admin-client-notes", false);
  });
  await step("calendar segment slide", async () => {
    await page.goto(`${BASE}/admin/calendar`, { waitUntil: "networkidle" });
    await settle(page);
    await page.getByRole("radio", { name: /month/i }).click();
    await page.waitForTimeout(110);
    await shot(page, "anim-calendar-month-110ms", false);
  });

  // Overlays: enter frames and settled frames
  await step("drawer", async () => {
    await page.goto(`${BASE}/admin/services`, { waitUntil: "networkidle" });
    await settle(page);
    await page.getByRole("button", { name: /new service/i }).first().click();
    await page.waitForTimeout(100);
    await shot(page, "anim-drawer-100ms", false);
    await settle(page);
    await shot(page, "drawer-open", false);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(90);
    await shot(page, "anim-drawer-closing-90ms", false);
  });
  await step("account menu", async () => {
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "networkidle" });
    await settle(page);
    await page.getByRole("button", { name: /account menu/i }).first().click();
    await page.waitForTimeout(70);
    await shot(page, "anim-menu-70ms", false);
    await settle(page, 400);
    await shot(page, "account-menu", false);
    await page.mouse.click(700, 300);
  });
  await step("notifications", async () => {
    await page.getByRole("button", { name: /^notifications$/i }).first().click();
    await settle(page, 400);
    await shot(page, "notifications", false);
    await page.mouse.click(700, 300);
  });
  await step("modal", async () => {
    await page.getByRole("switch").first().click();
    await page.waitForTimeout(100);
    await shot(page, "anim-modal-100ms", false);
    await settle(page, 400);
    await shot(page, "modal-open", false);
    await page.keyboard.press("Escape");
  });
  await step("palette", async () => {
    await page.keyboard.press("Meta+k");
    await settle(page, 300);
    await shot(page, "command-palette", false);
    await page.keyboard.press("Escape");
  });
  await step("toast", async () => {
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "networkidle" });
    await settle(page);
    await page.getByRole("switch").first().click();
    await settle(page, 400);
    await page.getByRole("dialog").getByRole("button").last().click();
    await settle(page, 500);
    await shot(page, "toast", false);
  });

  await step("to-do", async () => {
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "networkidle" });
    await settle(page);
    await page.getByRole("button", { name: /new to-do/i }).click();
    await settle(page, 400);
    await shot(page, "todo-modal", false);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").first().fill("Send the March workshop recap");
    await dialog.getByRole("textbox").nth(1).fill(
      "Summarise the three decisions, the open pricing question and who owns each follow-up before Friday's call.",
    );
    await dialog.getByRole("button", { name: /add to-do/i }).click();
    await settle(page);
    await shot(page, "dashboard-with-todo", false);
    const expand = page.getByRole("button", { name: /full description/i }).first();
    await page.getByRole("checkbox").first().hover();
    await expand.click();
    await page.waitForTimeout(100);
    await shot(page, "anim-todo-expand-100ms", false);
    await settle(page, 500);
    await shot(page, "todo-expanded", false);
  });
  await step("notifications page", async () => {
    await page.goto(`${BASE}/admin/notifications`, { waitUntil: "networkidle" });
    await settle(page);
    await shot(page, "notifications-page", false);
    for (let i = 0; i < 12; i += 1) { await page.mouse.wheel(0, 500); await page.waitForTimeout(200); }
    await settle(page, 800);
    await shot(page, "notifications-page-full");
  });

  // Revisit: should only fade (no stagger)
  await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  await shot(page, "anim-revisit-bookings-150ms", false);

  // Mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const r of ["dashboard", "bookings", "calendar", "services"]) {
    await mp.goto(`${BASE}/admin/${r}`, { waitUntil: "networkidle" });
    await settle(mp);
    await mp.screenshot({ path: `${OUT}/mobile-${r}.png` });
    console.log("shot mobile", r);
  }
  await step("mobile sidebar sheet", async () => {
    await mp.goto(`${BASE}/admin/dashboard`, { waitUntil: "networkidle" });
    await settle(mp);
    await mp.getByRole("button", { name: /sidebar/i }).first().click();
    await mp.waitForTimeout(110);
    await mp.screenshot({ path: `${OUT}/anim-mobile-sheet-110ms.png` });
    await settle(mp, 500);
    await mp.screenshot({ path: `${OUT}/mobile-sheet.png` });
    console.log("shot mobile sheet");
  });

  // Landing hero: single components at 2x, on a fixed weekday morning so the greeting and
  // "next call in 3h 14m" agree. Each card is found by a heading or label inside it and
  // captured to its edges, 1px inside the border (HeroShots draws its own frame).
  await step("hero images", async () => {
    mkdirSync(HERO, { recursive: true });
    const morning = new Date("2026-11-18T08:16:00");
    const desk = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2, storageState: await ctx.storageState() });
    const dp = await desk.newPage();
    await dp.clock.setFixedTime(morning);
    const card = async (locator, name, maxHeight) => {
      const box = await locator.first().evaluate((node, limit) => {
        let el = node;
        while (el && !(el.classList.contains("rounded-lg") && el.classList.contains("border"))) el = el.parentElement;
        const r = (el ?? node).getBoundingClientRect();
        return { x: r.x + 1, y: r.y + 1, width: r.width - 2, height: Math.min(r.height - 2, limit ?? Infinity) };
      }, maxHeight);
      await dp.screenshot({ path: path.join(HERO, `hero-${name}.png`), clip: box });
    };
    await dp.goto(`${BASE}/admin/dashboard`, { waitUntil: "networkidle" });
    await settle(dp, 1500);
    await dp.mouse.move(0, 1199);
    await card(dp.getByText("Your next call", { exact: true }), "next-call");
    await card(dp.getByText("Revenue trend", { exact: true }), "trend");
    await card(dp.getByText("Revenue this month", { exact: true }), "kpi");
    await dp.goto(`${BASE}/admin/messages`, { waitUntil: "networkidle" });
    await settle(dp);
    // The list card is tall; keep the search box and the first three conversations.
    await card(dp.getByPlaceholder("Find a client"), "messages", 276);
    await dp.goto(`${BASE}/booking`, { waitUntil: "networkidle" });
    await settle(dp);
    // The first two service cards, with the page's paper around them.
    const first = await dp.getByText("Discovery Call", { exact: true }).first().boundingBox();
    if (first) {
      await dp.screenshot({ path: path.join(HERO, "hero-services.png"), clip: { x: first.x - 70, y: first.y - 32, width: 472, height: 280 } });
    }
    console.log("shot hero images");
  });

  // Reduce Motion: everything should be there at once
  const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rp = await rm.newPage();
  await login(rp);
  await rp.waitForTimeout(60);
  await rp.screenshot({ path: `${OUT}/reduced-dashboard-60ms.png` });
  console.log("shot reduced-dashboard-60ms");

  await browser.close();
  console.log("done");
})();
