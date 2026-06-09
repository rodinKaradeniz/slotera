import personasJson from "@/data/mock/demo-personas.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { listServices } from "./services.service";
import type { DemoPersona } from "@/types/demo";
import type { Service } from "@/types/service";
import { NotImplementedError } from "./_errors";

const personas = JSON.parse(JSON.stringify(personasJson)) as DemoPersona[];

/**
 * The standard (no-persona) booking page belongs to the default provider — a
 * strategy advisor (see settings.business.displayName). It intentionally shows
 * only that provider's curated service set, NOT every active service in the
 * workspace. The vet/therapy/trainer services belong to their own persona
 * providers and only surface under `?demo=<slug>`; the admin Services page
 * still lists the full set via `listServices()`.
 */
export const STANDARD_BOOKING_SERVICE_IDS = [
  "svc-discovery",
  "svc-deepdive",
  "svc-sprint",
  "svc-workshop",
] as const;

/**
 * Resolves the curated, ordered service list the public booking page should
 * show. With a persona, uses that persona's `serviceIds`; without one, uses the
 * default provider's curated standard set. This is the single resolver the
 * booking flow uses — it does not render-time slice "all active services".
 */
export async function listBookingServices(
  persona: DemoPersona | null,
): Promise<Service[]> {
  const active = (await listServices()).filter((s) => s.active);
  const ids = persona ? persona.serviceIds : STANDARD_BOOKING_SERVICE_IDS;
  return ids
    .map((id) => active.find((s) => s.id === id))
    .filter((s): s is Service => Boolean(s));
}

export async function listPersonas(): Promise<DemoPersona[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listPersonas");
  await sleep(20);
  return [...personas];
}

export async function getPersona(slug: string): Promise<DemoPersona | null> {
  if (dataSource !== "mock") throw new NotImplementedError("getPersona");
  await sleep(20);
  return personas.find((p) => p.slug === slug) ?? null;
}

/** Synchronous lookup used by purely presentational call sites. */
export function getPersonaSync(slug: string | null): DemoPersona | null {
  if (!slug) return null;
  return personas.find((p) => p.slug === slug) ?? null;
}
