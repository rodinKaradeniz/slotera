import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import type { Lang } from "@/lib/i18n";
export async function getLanguagePreference(): Promise<Lang> {
  return (await apiRequest<components["schemas"]["LanguagePreference"]>("/auth/preferences")).language;
}
export async function saveLanguagePreference(language: Lang): Promise<void> {
  await apiRequest<components["schemas"]["LanguagePreference"], { language: Lang }>("/auth/preferences", { method: "PATCH", csrf: true, body: { language } });
}
