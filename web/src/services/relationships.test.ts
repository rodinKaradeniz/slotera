import { describe, expect, it } from "vitest";
import { listFormsForService, updateForm } from "./forms.service";
import { listPackagesForService, updatePackage } from "./packages.service";

// Mock mode. A broken relationship filter shows up as an empty list, not an error, so
// these pin the expected results against the mock data.
describe("service relationships (mock mode)", () => {
  it("lists the active forms attached to a service", async () => {
    expect((await listFormsForService("svc-sprint")).map((f) => f.id)).toEqual([
      "frm-consult-context",
    ]);
    expect(await listFormsForService("svc-unknown")).toEqual([]);

    await updateForm("frm-consult-context", { status: "inactive" });
    expect(await listFormsForService("svc-sprint")).toEqual([]);
  });

  it("lists the active packages that include a service", async () => {
    expect((await listPackagesForService("svc-sprint")).map((p) => p.id).sort()).toEqual([
      "pkg-coaching-4",
      "pkg-strategy-sprint",
    ]);
    expect((await listPackagesForService("svc-discovery")).map((p) => p.id)).toEqual([
      "pkg-coaching-4",
    ]);

    await updatePackage("pkg-coaching-4", { status: "inactive" });
    expect((await listPackagesForService("svc-discovery")).map((p) => p.id)).toEqual([]);
  });
});
