"use client";

// Slotera's own plans (what Merulio charges operators). The Billing tab exists only in
// the real app; the demo hides it.

import { dataSource } from "@/lib/env";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { NotImplementedError } from "./_errors";

export type WorkspaceBilling = components["schemas"]["WorkspaceBillingResponse"];

/** The operator's Slotera plan, trial and price list (docs/PRODUCT.md → Pricing). */
export async function getWorkspaceBilling(): Promise<WorkspaceBilling> {
  if (dataSource !== "api") throw new NotImplementedError("getWorkspaceBilling");
  return apiRequest<WorkspaceBilling>("/settings/billing");
}
