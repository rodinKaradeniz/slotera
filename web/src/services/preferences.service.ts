import { restoreSession } from "./auth.service";
import { verifiedMetadata, updateVerifiedMetadata } from "@/api/query-cache";
import { readSession, writeSession } from "@/lib/session";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import type { Lang } from "@/lib/i18n";
export async function getLanguagePreference(): Promise<Lang> {
  const saved = verifiedMetadata().language;
  if (saved) return saved;
  return (await restoreSession())?.language ?? "en";
}
export async function saveLanguagePreference(language: Lang): Promise<void> {
  await apiRequest<components["schemas"]["LanguagePreference"], { language: Lang }>("/auth/preferences", { method: "PATCH", csrf: true, body: { language } });
  updateVerifiedMetadata({language});
  const session = readSession();
  if (session) writeSession({...session, language});
}
