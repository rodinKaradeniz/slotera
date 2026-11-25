import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadLang, translate, type Lang } from "../src/lib/i18n";
const api = "http://localhost:8011";
const origin = { Origin: "http://localhost:3345" };
async function headers(page: Page, version?: number) {
  const cookie = (await page.context().cookies(api)).find(
    (c) => c.name === "slotera_csrf",
  );
  return {
    ...origin,
    "X-CSRF-Token": cookie?.value ?? "",
    "Idempotency-Key": crypto.randomUUID(),
    ...(version ? { "If-Match": `"v${version}"` } : {}),
  };
}
function fixture(operation: string, value = "") {
  return JSON.parse(
    execFileSync(
      resolve("../server/.venv/bin/python"),
      [resolve("../server/scripts/browser_fixture.py"), operation, value],
      { encoding: "utf8" },
    ),
  );
}
// Turkish and German load lazily; until loaded, translate() returns English.
test.beforeAll(() => Promise.all([loadLang("tr"), loadLang("de")]));

for (const lang of ["en", "tr", "de"] as Lang[]) {
  test(`client communication, follow-up and tasks in ${lang}`, async ({
    page,
    browser,
  }, info) => {
    const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
    fixture("prepare-auth");
    const login = await page.request.post(`${api}/auth/login`, {
      headers: origin,
      data: { email: "hello@slotera.io", password: "slotera-local-only" },
    });
    expect(login.status()).toBe(200);
    await page.request.patch(`${api}/auth/preferences`, {
      headers: await headers(page),
      data: { language: lang },
    });
    if (lang === "en") {
      await page.goto("/admin/messages");
      if (info.project.name === "mobile")
        await page.getByRole("button", { name: t("chat.conversations"), exact: true }).click();
      await page.getByRole("button", { name: /^Sofia Marin/ }).click();
      await expect(page.getByText("Hi Lena! Could we focus on the funding narrative in our next session?", { exact: true })).toBeVisible();
      await expect(page.getByText("That fits well. We will leave time to work through both.", { exact: true })).toBeVisible();
      mkdirSync("browser-artifacts", { recursive: true });
      await page.screenshot({path: `browser-artifacts/sample-messages-${info.project.name}.png`});
    }
    const label = `Communication ${info.project.name} ${lang}`;
    const email = `communication-${info.project.name}-${lang}@example.com`;
    const client = await (
      await page.request.post(`${api}/clients`, {
        headers: await headers(page),
        data: { name: label, email },
      })
    ).json();
    const serviceResponse = await page.request.post(`${api}/services`, {
      headers: await headers(page),
      data: {
        name: label,
        description: "Synthetic",
        durationMin: 30,
        priceCents: 0,
        bookingMode: "scheduled",
        capacity: 1,
        locationType: "online",
        location: label,
        confirmationPolicy: "automatic",
      },
    });
    expect(serviceResponse.status()).toBe(201);
    const service = await serviceResponse.json();
    const formResponse = await page.request.post(`${api}/forms`, {
      headers: await headers(page),
      data: {
        name: label,
        description: "Synthetic",
        status: "active",
        fields: [
          {
            id: "answer",
            label: "Synthetic feedback",
            type: "yes_no",
            required: true,
          },
        ],
        attachedServiceIds: [],
        requiredBeforePayment: false,
      },
    });
    expect(formResponse.status()).toBe(201);
    const form = await formResponse.json();
    const rule = await page.request.patch(
      `${api}/services/${service.id}/follow-up`,
      {
        headers: await headers(page, service.version),
        data: {
          enabled: true,
          delayHours: 0,
          message: "Synthetic follow-up",
          formTemplateId: form.id,
        },
      },
    );
    expect(rule.status()).toBe(200);
    // Use a free interval beyond every existing synthetic occurrence.
    const sessions = await (
      await page.request.get(`${api}/sessions?limit=500`)
    ).json();
    const last = Math.max(
      Date.now(),
      ...sessions.items.map((s: { endAt: string }) => Date.parse(s.endAt)),
    );
    const start = new Date(last + 86400_000);
    const sessionResponse = await page.request.post(`${api}/sessions`, {
      headers: await headers(page),
      data: {
        serviceId: service.id,
        startAt: start.toISOString(),
        endAt: new Date(+start + 1800_000).toISOString(),
        capacity: 1,
        locationType: "online",
        location: label,
      },
    });
    expect(sessionResponse.status()).toBe(201);
    const session = await sessionResponse.json();
    const bookingResponse = await page.request.post(`${api}/bookings`, {
      headers: await headers(page),
      data: {
        clientId: client.id,
        sessionId: session.id,
        auditReason: "Synthetic verification",
        sendEmail: false,
        language: lang,
      },
    });
    expect(bookingResponse.status()).toBe(201);
    const booking = await bookingResponse.json();
    const customerContext = await browser.newContext({
      ...info.project.use,
      baseURL: "http://localhost:3345",
    });
    const customer = await customerContext.newPage();
    await customer.route(
      (url) => url.hostname !== "localhost",
      (route) => route.abort(),
    );
    try {
      await customer.goto("/client/lena/sign-in");
      await customer
        .getByRole("radio", { name: lang.toUpperCase(), exact: true })
        .click();
      await customer.getByLabel(t("ui.email"), { exact: false }).fill(email);
      await customer
        .getByRole("button", { name: t("client.sendLink"), exact: true })
        .click();
      await expect(
        customer.getByText(t("client.linkSent"), { exact: true }),
      ).toBeVisible();
      const link = fixture("client-link", email).url;
      await customer.goto(link);
      await customer
        .getByRole("button", { name: t("client.signIn"), exact: true })
        .click();
      await expect(customer).toHaveURL(/\/client\/lena$/);
      await customer
        .getByLabel(t("messages.message"), { exact: true })
        .fill(`Client ${lang}`);
      await customer
        .getByRole("button", { name: t("messages.send"), exact: true })
        .click();
      await expect(
        customer.getByText(`Client ${lang}`, { exact: true }),
      ).toBeVisible();
      await page.goto(`/admin/messages?clientId=${client.id}`);
      // The conversation list previews the same text; the thread bubble comes after it.
      await expect(
        page.getByText(`Client ${lang}`, { exact: true }).last(),
      ).toBeVisible();
      await page
        .getByLabel(t("messages.message"), { exact: true })
        .fill(`Consultant ${lang}`);
      await page
        .getByRole("button", { name: t("messages.send"), exact: true })
        .click();
      await expect(
        page.getByText(`Consultant ${lang}`, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel(t("messages.message"), { exact: true }),
      ).toHaveValue("");
      if (lang === "en") {
        mkdirSync("browser-artifacts", { recursive: true });
        await page.screenshot({
          path: `browser-artifacts/messages-${info.project.name}.png`,
        });
      }
      await customer
        .getByRole("button", { name: t("ui.refresh"), exact: true })
        .click();
      await expect(
        customer.getByText(`Consultant ${lang}`, { exact: true }),
      ).toBeVisible();
      await customer
        .getByRole("tab", { name: t("client.account"), exact: true })
        .click();
      await customer.getByLabel(t("client.digest"), { exact: true }).uncheck();
      await customer
        .getByRole("button", { name: t("client.save"), exact: true })
        .click();
      await expect(
        customer.getByText(t("client.saved"), { exact: true }),
      ).toBeVisible();
      await customer.reload();
      await customer
        .getByRole("tab", { name: t("client.account"), exact: true })
        .click();
      await expect(
        customer.getByLabel(t("client.digest"), { exact: true }),
      ).not.toBeChecked();
      await expect(
        customer.getByLabel(t("client.language"), { exact: true }),
      ).toHaveValue(lang);
      fixture("finish-session", booking.id);
      const completed = await page.request.post(
        `${api}/bookings/${booking.id}/complete`,
        {
          headers: await headers(page),
          data: { auditReason: "Synthetic completion" },
        },
      );
      expect(completed.status()).toBe(200);
      fixture("queue-followups");
      await page.goto(`/admin/bookings/${booking.id}`);
      await expect(
        page.getByRole("heading", { name: t("followup.title"), exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Synthetic follow-up", { exact: true }),
      ).toBeVisible();
      const metadata = await (
        await page.request.get(`${api}/bookings/${booking.id}/emails`)
      ).json();
      expect(
        metadata.items.some(
          (m: { kind: string; status: string; simulated: boolean }) =>
            m.kind === "booking_followup" &&
            m.status === "queued" &&
            m.simulated,
        ),
      ).toBe(true);
      await customer
        .getByRole("tab", { name: t("client.bookings"), exact: true })
        .click();
      await customer
        .getByRole("button", { name: t("client.openBooking"), exact: true })
        .click();
      await customer
        .getByRole("radio", { name: t("booking.field.no"), exact: true })
        .click();
      await customer
        .getByRole("button", { name: t("forms.submit"), exact: true })
        .click();
      await expect(
        customer.getByText(t("forms.corrections"), { exact: true }),
      ).toBeVisible();
      await page.goto("/admin/dashboard");
      await page.getByRole("button", { name: t("todo.new"), exact: true }).click();
      const dialog = page.getByRole("dialog", { name: t("todo.new"), exact: true });
      await dialog.getByRole("textbox", { name: t("todo.field.title") }).fill(label);
      await dialog.getByRole("button", { name: t("todo.add.button"), exact: true }).click();
      await expect(dialog).toHaveCount(0);
      const checkbox = page.getByRole("checkbox", { name: label, exact: true });
      await expect(checkbox).not.toBeChecked();
      const tasks = await (await page.request.get(`${api}/tasks?general_only=true`)).json();
      expect(tasks.items.find((item: { title: string }) => item.title === label).sessionId).toBeNull();
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await page.reload();
      await expect(page.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
      await expect(page.getByLabel(t("todo.title"), {exact: true}).locator("input[type=date]")).toHaveCount(0);
      if (lang === "en") await page.screenshot({path: `browser-artifacts/todo-${info.project.name}.png`});
      expect(
        await customer.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    } catch (error) {
      {
        mkdirSync("browser-artifacts", { recursive: true });
        await customer
          .screenshot({
            path: `browser-artifacts/communication-${info.project.name}-${lang}.png`,
          })
          .catch(() => undefined);
      }
      throw error;
    } finally {
      await customerContext.close();
    }
  });
}
