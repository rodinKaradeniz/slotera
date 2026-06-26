import resourcesJson from "@/data/mock/resources.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type { ResourceLink } from "@/types/resource-link";
import { NotImplementedError } from "./_errors";

/**
 * Shared resources attached to a session. Mirrors the mock-first conventions of
 * the other services (see CLAUDE.md → Data layer). Phase 1 is display-only:
 * resources are lightweight links/materials, not uploads or stored files.
 * `clientVisible` resources may surface on the customer reservation workspace.
 */
const mock: ResourceLink[] = JSON.parse(
  JSON.stringify(resourcesJson),
) as ResourceLink[];

export async function listResourcesForSession(
  sessionId: string,
): Promise<ResourceLink[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listResourcesForSession");
  await sleep(50);
  return mock.filter((r) => r.sessionId === sessionId);
}

/**
 * Client-visible resources for a session — the "Shared resources" surfaced on
 * the customer reservation workspace. Internal-only resources are never
 * returned.
 */
export async function listClientResourcesForSession(
  sessionId: string,
): Promise<ResourceLink[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listClientResourcesForSession");
  await sleep(50);
  return mock.filter((r) => r.sessionId === sessionId && r.clientVisible === true);
}
