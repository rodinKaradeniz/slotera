import { expect, it } from "vitest";
import { demoDayOffset, shiftDemoDates } from "./mock-data";

it("moves the demo's 17 May 2026 onto the real today", () => {
  expect(demoDayOffset(new Date("2026-05-17T15:00:00Z"))).toBe(0);
  expect(demoDayOffset(new Date("2026-11-18T08:00:00Z"))).toBe(185);
});

it("shifts dates and date-times by whole days and leaves other strings alone", () => {
  const shifted = shiftDemoDates({
    startISO: "2026-05-17T08:30:00.000Z",
    dueDate: "2026-05-16",
    nested: [{ createdAt: "2026-05-16T09:00:00Z" }],
    name: "Mila Ozawa",
    reference: "2026-ABC",
    count: 3,
  }, 185);
  expect(shifted).toEqual({
    startISO: "2026-11-18T08:30:00.000Z",
    dueDate: "2026-11-17",
    nested: [{ createdAt: "2026-11-17T09:00:00.000Z" }],
    name: "Mila Ozawa",
    reference: "2026-ABC",
    count: 3,
  });
});
