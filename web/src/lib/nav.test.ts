import { afterEach, describe, expect, it, vi } from "vitest";

// `dataSource` is read once at import, so each mode gets a fresh module graph.
async function loadNav(source: "mock" | "api") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", source);
  return import("./nav");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(["mock", "api"] as const)("navigation in %s mode", (source) => {
  it("lets every role reach its own home page", async () => {
    // Regression: the API guard once redirected operators away from their home, looping.
    const nav = await loadNav(source);
    for (const role of ["operator_admin", "superadmin"] as const) {
      expect(nav.isNavRoute(role, nav.homePathForRole(role))).toBe(true);
    }
  });

  it("allows nested pages under a listed section", async () => {
    const nav = await loadNav(source);
    expect(nav.isNavRoute("superadmin", "/superadmin/workspaces/abc")).toBe(true);
    expect(nav.isNavRoute("operator_admin", "/superadmin/overview")).toBe(false);
  });
});

describe("API-mode operator navigation", () => {
  it("hides packages, which have no API yet", async () => {
    const nav = await loadNav("api");
    expect(nav.isNavRoute("operator_admin", "/admin/packages")).toBe(false);
    expect(nav.isNavRoute("operator_admin", "/admin/calendar")).toBe(true);
  });
});

describe("bookingPageHref", () => {
  it("points the demo at its sample flow", async () => {
    const nav = await loadNav("mock");
    expect(nav.bookingPageHref()).toBe("/booking");
  });

  it("falls back to settings when the real app has no session yet", async () => {
    const nav = await loadNav("api");
    expect(nav.bookingPageHref()).toBe("/admin/settings");
  });
});
