import { readFileSync } from "node:fs";
import path from "node:path";
import { PublicNav } from "@/components/layout/PublicNav";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { renderMarkdown } from "@/lib/markdown";

export type LegalDocument = "terms" | "privacy" | "dpa";

/** Renders `src/content/legal/<doc>.md` at build time. Legal text is English only. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const source = readFileSync(
    path.join(process.cwd(), "src/content/legal", `${doc}.md`),
    "utf8",
  );
  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-[760px] mx-auto w-full px-6 pt-12 pb-16">
        {renderMarkdown(source)}
      </main>
      <PublicFooter />
    </div>
  );
}
