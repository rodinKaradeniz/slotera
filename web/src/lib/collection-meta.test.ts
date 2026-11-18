import { expect, it } from "vitest";
import { collectionMeta } from "./collection-meta";
it("labels the full catalog total separately from its state breakdown", () => {
  expect(collectionMeta("forms", {active: 4, inactive: 2}, "en")).toBe("6 forms · 4 Active · 2 Inactive");
  expect(collectionMeta("services", {active: 1}, "en")).toBe("1 service · 1 Active · 0 Inactive");
});
it("uses client states and translated entity labels", () => {
  expect(collectionMeta("clients", {new: 1, active: 3, dormant: 2}, "en")).toBe("6 clients · 1 New · 3 Active · 2 Dormant");
  expect(collectionMeta("clients", {active: 6}, "tr")).toContain("6 danışan");
  expect(collectionMeta("packages", {active: 2}, "de")).toContain("2 Pakete");
});
