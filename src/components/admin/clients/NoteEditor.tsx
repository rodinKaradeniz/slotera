"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { cn } from "@/lib/cn";

/**
 * Lightweight Tiptap rich-text editor for client notes. Admins format visually
 * while typing — no markdown markers. Deliberately minimal: StarterKit only,
 * with Bold / Italic / Heading / lists / quote / undo-redo. No images, uploads,
 * embeds, tables, colors, or font pickers. Produces safe HTML (rendered back via
 * NoteContent) from controlled, admin-authored content only.
 */

// Shared prose styling for editable + read-only surfaces so notes look the same
// while writing and after saving.
export const NOTE_PROSE =
  "text-body text-ink-2 " +
  "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_strong]:font-semibold [&_strong]:text-ink [&_em]:italic " +
  "[&_h1]:text-[15px] [&_h1]:font-semibold [&_h1]:text-ink [&_h1]:mt-3 [&_h1]:first:mt-0 " +
  "[&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-3 [&_h2]:first:mt-0 " +
  "[&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-ink [&_h3]:mt-3 [&_h3]:first:mt-0 " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 " +
  "[&_li]:my-0.5 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-ink-3 [&_blockquote]:italic [&_blockquote]:my-1";

export function NoteEditor({
  value,
  onChange,
  invalid,
  placeholder = "Write a note about this client…",
}: {
  value: string;
  onChange: (html: string) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        // Trim features we don't want in a lightweight note editor.
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          NOTE_PROSE,
          "min-h-[140px] max-h-[320px] overflow-y-auto px-3 py-2 focus:outline-none",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      // Emit empty string (not "<p></p>") when the doc has no text so the
      // caller's required-field validation works on real content.
      onChange(editor.getText().trim() ? editor.getHTML() : "");
    },
  });

  // Keep the editor in sync when the caller resets `value` (e.g. opening the
  // modal for a different note or for a fresh "new" note).
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getText().trim() ? editor.getHTML() : "";
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-line bg-surface min-h-[180px]" />
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface overflow-hidden",
        invalid ? "border-danger" : "border-line",
        "focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent",
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line-soft bg-paper-2 px-1.5 py-1">
      <ToolButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic font-serif">I</span>
      </ToolButton>
      <Divider />
      <ToolButton
        label="Heading"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        H
      </ToolButton>
      <ToolButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </ToolButton>
      <ToolButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        Quote
      </ToolButton>
      <Divider />
      <ToolButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </ToolButton>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // Don't let the button steal the editor selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "min-w-7 h-7 px-1.5 rounded text-[12px] inline-flex items-center justify-center transition-colors",
        "disabled:opacity-40 disabled:pointer-events-none",
        active
          ? "bg-surface-warm text-ink"
          : "text-ink-2 hover:bg-surface hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />;
}
