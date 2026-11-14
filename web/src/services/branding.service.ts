import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { getSettings, updateSettings } from "@/services/settings.service";
export type Branding = components["schemas"]["Branding"] & {version?: number};
export const DEFAULT_BRANDING: Branding = { accent: "#3d5a3d", fontFamily: "serif" };
export async function getBranding(): Promise<Branding> {
  return dataSource === "api" ? apiRequest<Branding>("/settings/branding") : (await getSettings()).branding;
}
export async function saveBranding(input: Branding): Promise<Branding> {
  if (dataSource === "mock") return (await updateSettings({ branding: { accent: input.accent!, fontFamily: input.fontFamily! } })).branding;
  return apiRequest<Branding, Branding>("/settings/branding", { method: "PATCH", csrf: true, expectedVersion: input.version, body: {accent: input.accent, fontFamily: input.fontFamily} });
}
