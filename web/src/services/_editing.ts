import { ApiRequestError } from "./_errors";

export function nextEditVersion(item: {version?: number}, expected?: number): number {
  const current = item.version ?? 1;
  if (expected !== undefined && expected !== current) {
    throw new ApiRequestError(409, "resource_stale", "This item changed elsewhere. Your draft is kept; review the latest version before saving.");
  }
  return current + 1;
}
