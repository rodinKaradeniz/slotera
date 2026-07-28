import * as React from "react";
import { cn } from "@/lib/cn";
import { NOTE_PROSE } from "./NoteEditor";

/**
 * Read-only renderer for a client note. The HTML is admin-authored and produced
 * solely by the lightweight Tiptap editor (NoteEditor) — a contained, controlled
 * source (StarterKit tags only: p, strong, em, h3, ul/ol/li, blockquote), never
 * client- or network-supplied. `dangerouslySetInnerHTML` is acceptable here for
 * that reason; do not render untrusted HTML through this component.
 */
export function NoteContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn(NOTE_PROSE, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
