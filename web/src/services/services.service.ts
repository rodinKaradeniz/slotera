import servicesJson from "@/data/mock/services.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Service, ServiceInput } from "@/types/service";
import { NotFoundError, NotImplementedError } from "./_errors";

let mock: Service[] = JSON.parse(JSON.stringify(servicesJson)) as Service[];

export async function listServices(): Promise<Service[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listServices");
  await sleep(60);
  return [...mock];
}

export async function getService(id: string): Promise<Service | null> {
  if (dataSource !== "mock") throw new NotImplementedError("getService");
  await sleep(40);
  return mock.find((s) => s.id === id) ?? null;
}

export async function createService(input: ServiceInput): Promise<Service> {
  if (dataSource !== "mock") throw new NotImplementedError("createService");
  await sleep(120);
  const created: Service = {
    ...input,
    id: makeId("svc"),
    createdAtISO: new Date().toISOString(),
  };
  mock = [created, ...mock];
  return created;
}

export async function updateService(
  id: string,
  patch: Partial<ServiceInput>,
): Promise<Service> {
  if (dataSource !== "mock") throw new NotImplementedError("updateService");
  await sleep(100);
  const idx = mock.findIndex((s) => s.id === id);
  if (idx === -1) throw new NotFoundError("service", id);
  const next: Service = { ...mock[idx], ...patch };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function deactivateService(id: string): Promise<Service> {
  return updateService(id, { active: false });
}

export async function activateService(id: string): Promise<Service> {
  return updateService(id, { active: true });
}

export async function removeService(id: string): Promise<void> {
  if (dataSource !== "mock") throw new NotImplementedError("removeService");
  await sleep(80);
  mock = mock.filter((s) => s.id !== id);
}
