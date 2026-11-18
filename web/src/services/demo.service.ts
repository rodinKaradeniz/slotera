import { mockData } from "@/services/adapters/mock-data";

import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type { DemoPersona } from "@/types/demo";
import type { Service } from "@/types/service";
import { NotImplementedError } from "./_errors";
import { listPublicBookingServices } from "./public-booking.service";

const personas: DemoPersona[] = dataSource === "mock" ? mockData("demo-personas") : [] as DemoPersona[];

/**
 * The services the public booking page offers: exactly what the server's catalogue
 * returns (every active, publicly bookable service). A `?demo=<slug>` persona narrows
 * that list to its own `serviceIds`.
 */
export async function listBookingServices(
  persona: DemoPersona | null,
): Promise<Service[]> {
  const services = await listPublicBookingServices();
  if (!persona) return services;
  return persona.serviceIds
    .map((id) => services.find((s) => s.id === id))
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
