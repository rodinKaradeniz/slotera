import { translate, type Lang } from "./i18n";
export function collectionMeta(kind: "services" | "packages" | "forms" | "clients", states: Record<string, number>, lang: Lang): string {
  const total = Object.values(states).reduce((sum, n) => sum + n, 0);
  const keys = kind === "clients" ? ["new", "active", "dormant"] as const : ["active", "inactive"] as const;
  return [translate(lang, `counts.${kind}.${total === 1 ? "one" : "many"}`, {count: total}), ...keys.map((key) => `${states[key] ?? 0} ${translate(lang, `ui.${key}`)}`)].join(" · ");
}
