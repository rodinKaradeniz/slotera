import { describe, expect, it } from "vitest";
import { mapInquiry, mapPlatformOverview, mapPlatformWorkspace } from "./platform.service";
import { apiCurrency } from "./_currency";
import { ApiRequestError } from "./_errors";

describe("platform DTO mappers", () => {
  it("maps the overview's generated 30D field names", () => {
    // Regression: signups30D / bookings30D rendered as "undefined".
    const overview = mapPlatformOverview({
      workspacesTotal: 4,
      workspacesActive: 3,
      workspacesSuspended: 1,
      workspacesFree: 3,
      workspacesPro: 1,
      signups30D: 2,
      bookings30D: 17,
      inquiriesUnread: 5,
    });
    expect(overview.signups30d).toBe(2);
    expect(overview.bookings30d).toBe(17);
    expect(Object.values(overview).every((value) => typeof value === "number")).toBe(true);
  });

  it("maps an inquiry's read timestamp to a flag", () => {
    const base = {
      id: "i1",
      name: "Jo",
      email: "jo@example.com",
      company: null,
      reason: "business",
      message: "Hi",
      createdAt: "2026-10-01T10:00:00Z",
    };
    expect(mapInquiry({ ...base, readAt: null }).read).toBe(false);
    expect(mapInquiry({ ...base, readAt: "2026-10-02T10:00:00Z" }).read).toBe(true);
  });

  it("keeps workspace plan and currency from the detail DTO", () => {
    const workspace = mapPlatformWorkspace({
      id: "w1",
      name: "North Star",
      slug: "north-star",
      ownerName: "Ada Lovelace",
      ownerEmail: "ada@example.com",
      createdAt: "2026-10-01T10:00:00Z",
      operationalStatus: "active",
      plan: "pro",
      servicesCount: 1,
      clientsCount: 2,
      bookingsCount: 3,
      sessionsCount: 4,
      currency: "GBP",
      timezone: "Europe/London",
    });
    expect(workspace.plan).toBe("pro");
    expect(workspace.currency).toBe("GBP");
  });
});

describe("apiCurrency", () => {
  it("accepts supported currencies and rejects others loudly", () => {
    expect(apiCurrency("GBP")).toBe("GBP");
    expect(() => apiCurrency("TRY")).toThrow(ApiRequestError);
  });
});
