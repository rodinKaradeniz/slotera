import { loadLang } from "@/lib/i18n";

// The app loads Turkish and German on demand; tests translate synchronously in every language.
await Promise.all([loadLang("tr"), loadLang("de")]);
