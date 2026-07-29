import * as React from "react";
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
  // Start blank so server and client markup match; populate only after the
  // browser-side sanitizer has processed the persisted value.
  const [safeHtml, setSafeHtml] = React.useState("");

  React.useEffect(() => {
    setSafeHtml(sanitizeNoteHtml(html));
  }, [html]);

  return (
    <div
      className={cn(NOTE_PROSE, className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
