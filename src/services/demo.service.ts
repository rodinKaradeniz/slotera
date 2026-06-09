import personasJson from "@/data/mock/demo-personas.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type { DemoPersona } from "@/types/demo";
import { NotImplementedError } from "./_errors";

const personas = JSON.parse(JSON.stringify(personasJson)) as DemoPersona[];

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
