import packagesJson from "@/data/mock/packages.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { ServicePackage, ServicePackageInput } from "@/types/package";
import { NotFoundError, NotImplementedError } from "./_errors";

/**
 * Package service. Mirrors the mock-first conventions of the other services
 * (see CLAUDE.md → Data layer). A package is an ordered bundle of existing
 * services; the service↔package relationship is single-sourced on
 * `ServicePackage.items[].serviceId` — there is no `Service.packageIds` and no
 * dual-write. Editing inclusion happens by editing the package's items.
 */
let mock: ServicePackage[] = JSON.parse(
  JSON.stringify(packagesJson),
) as ServicePackage[];

export async function listPackages(): Promise<ServicePackage[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listPackages");
  await sleep(60);
  return [...mock];
}

export async function getPackage(id: string): Promise<ServicePackage | null> {
  if (dataSource !== "mock") throw new NotImplementedError("getPackage");
  await sleep(40);
  return mock.find((p) => p.id === id) ?? null;
}

export async function createPackage(
  input: ServicePackageInput,
): Promise<ServicePackage> {
  if (dataSource !== "mock") throw new NotImplementedError("createPackage");
  await sleep(120);
  const now = new Date().toISOString();
  const created: ServicePackage = {
    ...input,
    id: makeId("pkg"),
    createdAtISO: now,
    updatedAtISO: now,
  };
  mock = [created, ...mock];
  return created;
}

export async function updatePackage(
  id: string,
  patch: Partial<ServicePackageInput>,
): Promise<ServicePackage> {
  if (dataSource !== "mock") throw new NotImplementedError("updatePackage");
  await sleep(100);
  const idx = mock.findIndex((p) => p.id === id);
  if (idx === -1) throw new NotFoundError("package", id);
  const next: ServicePackage = {
    ...mock[idx],
    ...patch,
    updatedAtISO: new Date().toISOString(),
  };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function deactivatePackage(id: string): Promise<ServicePackage> {
  return updatePackage(id, { status: "inactive" });
}

export async function activatePackage(id: string): Promise<ServicePackage> {
  return updatePackage(id, { status: "active" });
}

export async function removePackage(id: string): Promise<void> {
  if (dataSource !== "mock") throw new NotImplementedError("removePackage");
  await sleep(80);
  mock = mock.filter((p) => p.id !== id);
}

export async function listActivePackages(): Promise<ServicePackage[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listActivePackages");
  await sleep(50);
  return mock.filter((p) => p.status === "active");
}

/**
 * Active packages that include a given service in one of their ordered items.
 * Powers the informational "Available in packages" hint on the public booking
 * Service step. Single-sourced on `items[].serviceId`.
 */
export async function listPackagesForService(
  serviceId: string,
): Promise<ServicePackage[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listPackagesForService");
  await sleep(50);
  return mock.filter(
    (p) =>
      p.status === "active" &&
      p.items.some((item) => item.serviceId === serviceId),
  );
}
