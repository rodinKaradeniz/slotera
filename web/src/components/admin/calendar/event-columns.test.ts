import { expect, it } from "vitest";
import { eventColumns } from "./event-columns";
import type { CalEvent } from "./EventBlock";
function event(id: string, startHour: number, endHour: number, cancelled = false): CalEvent {
  return {dateKey: "2026-11-17", startHour, endHour, session: {id, serviceId: "service", startISO: "2026-11-17T09:00:00Z", endISO: "2026-11-17T10:00:00Z", capacity: 1, bookedCount: 0, status: cancelled ? "cancelled" : "scheduled", locationType: "online", location: id, recurring: "one-off"}};
}
it("keeps cancelled and active overlapping sessions in separate clickable lanes", () => {
  const items = [event("old", 10, 11, true), event("active", 10, 10.5), event("later", 12, 13)];
  const columns = eventColumns(items);
  expect(columns.get("old")?.index).not.toBe(columns.get("active")?.index);
  expect(columns.get("old")?.total).toBe(2);
  expect(columns.get("later")).toEqual({index: 0, total: 1});
  expect(eventColumns([...items].reverse())).toEqual(columns);
});
it("uses the visible card height when short adjacent sessions would overlap", () => {
  const columns = eventColumns([event("first", 10, 10.1), event("next", 10.1, 10.2)]);
  expect(columns.get("first")?.total).toBe(2);
  expect(columns.get("first")?.index).not.toBe(columns.get("next")?.index);
});
