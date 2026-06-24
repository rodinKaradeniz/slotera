import packagesJson from "@/data/mock/package-programs.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type {
  PackageProgram,
  PackageProgramInput,
} from "@/types/package-program";
import { NotFoundError, NotImplementedError } from "./_errors";

/**
 * Package/program service. Mirrors the mock-first conventions of the other
 * services (see CLAUDE.md → Data layer). The service↔package relationship is
 * single-sourced on `PackageProgram.attachedServiceIds`; `setPackageServiceAttachment`
 * is the one mutation the service editor uses so there's no dual-write drift.
 */
let mock: PackageProgram[] = JSON.parse(
  JSON.stringify(packagesJson),
) as PackageProgram[];

export async function listPackagePrograms(): Promise<PackageProgram[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listPackagePrograms");
  await sleep(60);
  return [...mock];
}

export async function getPackageProgram(
  id: string,
): Promise<PackageProgram | null> {
  if (dataSource !== "mock") throw new NotImplementedError("getPackageProgram");
  await sleep(40);
  return mock.find((p) => p.id === id) ?? null;
}

export async function createPackageProgram(
  input: PackageProgramInput,
): Promise<PackageProgram> {
  if (dataSource !== "mock")
    throw new NotImplementedError("createPackageProgram");
  await sleep(120);
  const now = new Date().toISOString();
  const created: PackageProgram = {
    ...input,
    id: makeId("pkg"),
    createdAtISO: now,
    updatedAtISO: now,
  };
  mock = [created, ...mock];
  return created;
}

export async function updatePackageProgram(
  id: string,
  patch: Partial<PackageProgramInput>,
): Promise<PackageProgram> {
  if (dataSource !== "mock")
    throw new NotImplementedError("updatePackageProgram");
  await sleep(100);
  const idx = mock.findIndex((p) => p.id === id);
  if (idx === -1) throw new NotFoundError("package", id);
  const next: PackageProgram = {
    ...mock[idx],
    ...patch,
    updatedAtISO: new Date().toISOString(),
  };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function deactivatePackageProgram(
  id: string,
): Promise<PackageProgram> {
  return updatePackageProgram(id, { status: "inactive" });
}

export async function activatePackageProgram(
  id: string,
): Promise<PackageProgram> {
  return updatePackageProgram(id, { status: "active" });
}

export async function removePackageProgram(id: string): Promise<void> {
  if (dataSource !== "mock")
    throw new NotImplementedError("removePackageProgram");
  await sleep(80);
  mock = mock.filter((p) => p.id !== id);
}

export async function listActivePackagePrograms(): Promise<PackageProgram[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listActivePackagePrograms");
  await sleep(50);
  return mock.filter((p) => p.status === "active");
}

/**
 * Active packages/programs a given service can be used with. Powers the
 * informational "Available in packages" hint on the public booking Service step
 * and the service editor's relationship section. Single-sourced on
 * `attachedServiceIds`.
 */
export async function listPackageProgramsForService(
  serviceId: string,
): Promise<PackageProgram[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listPackageProgramsForService");
  await sleep(50);
  return mock.filter(
    (p) => p.status === "active" && p.attachedServiceIds.includes(serviceId),
  );
}

/**
 * Add or remove a service from a package's attachment list. Used by the
 * "Available in packages" control in the service editor so the relationship
 * stays single-sourced on the package.
 */
export async function setPackageServiceAttachment(
  packageId: string,
  serviceId: string,
  attached: boolean,
): Promise<PackageProgram> {
  const pkg = mock.find((p) => p.id === packageId);
  if (!pkg) throw new NotFoundError("package", packageId);
  const has = pkg.attachedServiceIds.includes(serviceId);
  if (attached === has) return pkg;
  const attachedServiceIds = attached
    ? [...pkg.attachedServiceIds, serviceId]
    : pkg.attachedServiceIds.filter((id) => id !== serviceId);
  return updatePackageProgram(packageId, { attachedServiceIds });
}
