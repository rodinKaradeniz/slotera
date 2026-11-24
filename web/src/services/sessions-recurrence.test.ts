import { beforeEach, expect, it, vi } from "vitest";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/env", () => ({ dataSource: "api" }));
vi.mock("@/api/client", () => ({ apiRequest: request, apiListAll: vi.fn() }));
vi.mock("@/api/query-cache", () => ({ verifiedMetadata: () => ({ timezone: "Europe/Berlin" }) }));
import { createSession } from "./sessions.service";

const session = {
  serviceId: "service", startISO: "2030-05-07T08:00:00Z", endISO: "2030-05-07T09:00:00Z",
  capacity: 6, bookedCount: 0, status: "scheduled" as const, locationType: "online" as const, location: "Zoom",
};
beforeEach(() => { request.mockReset(); request.mockRejectedValue(new Error("stop")); });

it("sends a custom rule: every two weeks on Tuesday and Thursday", async () => {
  await expect(createSession({ ...session, recurring: "custom", custom: { intervalWeeks: 2, weekdays: [2, 4] } })).rejects.toThrow("stop");
  expect(request.mock.calls[0][1].body.recurrence).toEqual({ intervalWeeks: 2, weekdays: [2, 4], endsOn: null });
});

it("sends weekly on the start date's weekday in the workspace time zone, and nothing for one-off", async () => {
  await expect(createSession({ ...session, recurring: "weekly" })).rejects.toThrow("stop");
  expect(request.mock.calls[0][1].body.recurrence).toEqual({ intervalWeeks: 1, weekdays: [2], endsOn: null });
  await expect(createSession({ ...session, recurring: "one-off" })).rejects.toThrow("stop");
  expect(request.mock.calls[1][1].body.recurrence).toBeNull();
});
