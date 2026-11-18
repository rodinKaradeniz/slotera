import { mockData } from "@/services/adapters/mock-data";
import { nextEditVersion } from "./_editing";
import { apiCurrency } from "./_currency";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { currentPublicWorkspaceSlug } from "@/services/public-booking.service";
import type { Currency } from "@/types/common";

import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { ServicePackage, ServicePackageInput } from "@/types/package";
import { ApiRequestError, NotFoundError } from "./_errors";

type PackageDto = components["schemas"]["PackageView"];
export type PackageOffer = Pick<ServicePackage, "id" | "name" | "description" | "priceCents" | "currency" | "items" | "featured">;
function mapOffer(dto: components["schemas"]["PublicPackageView"]): PackageOffer {
  return { ...dto, currency: dto.currency as Currency,
    items: dto.items.map((item) => ({ ...item, title: item.title ?? undefined, description: item.description ?? undefined })) };
}
function mapPackage(dto: PackageDto): ServicePackage {
  return { version: dto.version, ...mapOffer(dto), status: dto.status, notes: dto.notes ?? undefined,
    createdAtISO: dto.createdAt, updatedAtISO: dto.updatedAt };
}
function payload(input: ServicePackageInput): components["schemas"]["PackageInput"] {
  return { name: input.name, description: input.description, status: input.status,
    priceCents: input.priceCents, notes: input.notes, featured: input.featured ?? false,
    items: input.items.map((item) => ({ serviceId: item.serviceId, title: item.title, description: item.description })) };
}

/**
 * Package service. Mirrors the mock-first conventions of the other services
 * (see CLAUDE.md → Data layer). A package is an ordered bundle of existing
 * services; the service↔package relationship is single-sourced on
 * `ServicePackage.items[].serviceId` — there is no `Service.packageIds` and no
 * dual-write. Editing inclusion happens by editing the package's items.
 */
let mock: ServicePackage[] = dataSource === "mock" ? mockData("packages") : [] as ServicePackage[];
mock = mock.map((item) => ({...item, version: item.version ?? 1}));

export async function listPackages(): Promise<ServicePackage[]> {
  if (dataSource === "api") return (await apiRequest<components["schemas"]["PackageList"]>("/packages")).items.map(mapPackage);
  await sleep(60);
  return [...mock];
}

export async function getPackage(id: string): Promise<ServicePackage | null> {
  if (dataSource === "api") {
    try { return mapPackage(await apiRequest<PackageDto>(`/packages/${encodeURIComponent(id)}`)); }
    catch (error) { if (error instanceof ApiRequestError && error.status === 404) return null; throw error; }
  }
  await sleep(40);
  return mock.find((p) => p.id === id) ?? null;
}

export async function createPackage(
  input: ServicePackageInput,
): Promise<ServicePackage> {
  if (dataSource === "api") return mapPackage(await apiRequest<PackageDto, components["schemas"]["PackageInput"]>("/packages", { method: "POST", csrf: true, body: payload(input) }));
  await sleep(120);
  const now = new Date().toISOString();
  const created: ServicePackage = {
    version: 1,
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
  expectedVersion?: number,
): Promise<ServicePackage> {
  if (dataSource === "api") {
    const previous = await getPackage(id);
    if (!previous) throw new NotFoundError("package", id);
    return mapPackage(await apiRequest<PackageDto, components["schemas"]["PackageInput"]>(`/packages/${encodeURIComponent(id)}`, { method: "PUT", expectedVersion, csrf: true, body: payload({ ...previous, ...patch }) }));
  }
  await sleep(100);
  const idx = mock.findIndex((p) => p.id === id);
  if (idx === -1) throw new NotFoundError("package", id);
  const next: ServicePackage = {
    ...mock[idx],
    ...patch,
    version: nextEditVersion(mock[idx], expectedVersion),
    updatedAtISO: new Date().toISOString(),
  };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function deactivatePackage(id: string, expectedVersion?: number): Promise<ServicePackage> {
  return updatePackage(id, { status: "inactive" }, expectedVersion);
}

export async function activatePackage(id: string, expectedVersion?: number): Promise<ServicePackage> {
  return updatePackage(id, { status: "active" }, expectedVersion);
}

export async function removePackage(id: string,
  expectedVersion?: number,
): Promise<void> {
  if (dataSource === "api") return apiRequest<void>(`/packages/${encodeURIComponent(id)}`, { method: "DELETE", expectedVersion, csrf: true });
  const reviewed = mock.find((item) => item.id === id);
  if (reviewed) nextEditVersion(reviewed, expectedVersion);
  await sleep(80);
  mock = mock.filter((p) => p.id !== id);
}

export async function listActivePackages(): Promise<ServicePackage[]> {
  if (dataSource === "api") return (await listPackages()).filter((item) => item.status === "active");
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
): Promise<PackageOffer[]> {
  if (dataSource === "api") {
    const slug = currentPublicWorkspaceSlug();
    if (!slug) return [];
    const result = await apiRequest<components["schemas"]["PublicPackageList"]>(`/public/workspaces/${encodeURIComponent(slug)}/packages`);
    return result.items.map(mapOffer).filter((item) => item.items.some((entry) => entry.serviceId === serviceId));
  }
  await sleep(50);
  return mock.filter(
    (p) =>
      p.status === "active" &&
      p.items.some((item) => item.serviceId === serviceId),
  );
}

export async function listPackagePage(filters: import("@/types/page").ListFilter, signal?: AbortSignal): Promise<import("@/types/page").Page<import("@/types/package").PackageSummary>> {
  if (dataSource === "mock") {
    const items = mock.filter((item) => (!filters.search || item.name.toLowerCase().includes(filters.search.trim().toLowerCase())) && (filters.status === undefined || filters.status === "all" || item.status === filters.status));
    const states = mock.filter((item) => !filters.search || item.name.toLowerCase().includes(filters.search.trim().toLowerCase())).reduce<Record<string, number>>((counts, item) => { const state = item.status; counts[state] = (counts[state] ?? 0) + 1; return counts; }, {});
    const offset = filters.offset ?? 0;
    return {states, items: items.slice(offset, offset + 25).map((item) => ({...item, itemCount: item.items.length})), total: items.length, limit: 25, offset};
  }
  const params = new URLSearchParams({search: filters.search ?? "", limit: "25", offset: String(filters.offset ?? 0)});
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const page = await apiRequest<components["schemas"]["PackageSummaryPage"]>(`/packages/summaries?${params}`, {signal});
  return {...page, items: page.items.map((item) => ({...item, currency: apiCurrency(item.currency)}))};
}
