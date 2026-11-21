import { expect, it } from "vitest";
import { createService, listServices, removeService } from "./services.service";
import { createForm, getForm } from "./forms.service";
import { listPackages, removePackage } from "./packages.service";
import { listSessions } from "./sessions.service";

it("keeps a service with sessions after its packages are removed", async () => {
  // Discovery has sessions and sits only in an unsold package (a sold one can't be deleted).
  const serviceId = "svc-discovery";
  expect((await listSessions()).some((session) => session.serviceId === serviceId)).toBe(true);
  for (const offer of await listPackages()) {
    if (offer.items.some((item) => item.serviceId === serviceId)) await removePackage(offer.id);
  }
  await expect(removeService(serviceId)).rejects.toMatchObject({ code: "service_in_use" });
  expect((await listServices()).some((service) => service.id === serviceId)).toBe(true);
});
it("unlinks a deleted unused service while keeping its form", async () => {
  const original = (await listServices())[0];
  const service = await createService({ ...original, name: "Unused service" });
  const form = await createForm({ name: "Retained form", description: "", status: "active",
    attachedServiceIds: [service.id], requiredBeforePayment: false, fields: [] });
  await removeService(service.id);
  expect((await getForm(form.id))?.attachedServiceIds).toEqual([]);
});
