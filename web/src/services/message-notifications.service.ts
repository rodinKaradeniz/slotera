import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { ApiRequestError } from "./_errors";
export type DigestPreference = components["schemas"]["DigestPreference"];
let simulated: DigestPreference = { enabled: true, version: 1 };
export async function getDigestPreference(
  signal?: AbortSignal,
): Promise<DigestPreference> {
  return dataSource === "api"
    ? apiRequest<DigestPreference>("/settings/message-digest", { signal })
    : { ...simulated };
}
export async function saveDigestPreference(
  body: DigestPreference,
): Promise<DigestPreference> {
  if (dataSource === "api")
    return apiRequest<DigestPreference, DigestPreference>(
      "/settings/message-digest",
      { method: "PATCH", csrf: true, body },
    );
  if (body.version !== simulated.version)
    throw new ApiRequestError(
      409,
      "resource_stale",
      "Review the latest settings",
    );
  simulated = { ...body, version: body.version + 1 };
  return { ...simulated };
}
