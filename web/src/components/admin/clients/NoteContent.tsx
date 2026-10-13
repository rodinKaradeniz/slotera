import * as React from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/cn";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import { NOTE_PROSE } from "./NoteEditor";

/**
 * Read-only renderer for an operator-only client note. API writes sanitize the
 * limited Tiptap markup; this browser pass is a defensive second boundary before
 * the deliberately contained `dangerouslySetInnerHTML` render.
 */
export function NoteContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  // Blank on the server and during hydration so the markup matches; populated only
  // after the browser-side sanitizer has processed the persisted value.
  const hydrated = useHydrated();
  const safeHtml = React.useMemo(
    () => (hydrated ? sanitizeNoteHtml(html) : ""),
    [hydrated, html],
  );

  return (
    <div
      className={cn(NOTE_PROSE, className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
