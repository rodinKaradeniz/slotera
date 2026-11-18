"use client";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { motion } from "@/lib/motion";
import { usePresence } from "@/lib/use-presence";
import type { AIThread } from "@/services/assistant.service";
export function ConversationRow({
  thread,
  active,
  busy,
  onOpen,
  onDelete,
}: {
  thread: AIThread;
  active: boolean;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const row = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const item = React.useRef<HTMLButtonElement>(null);
  const menu = usePresence(open, motion.collapse);
  React.useEffect(() => {
    if (!open) return;
    item.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!row.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={row}
      data-thread-id={thread.id}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!busy) setOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
        if (
          event.key === "ContextMenu" ||
          (event.shiftKey && event.key === "F10")
        ) {
          event.preventDefault();
          setOpen(true);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="group flex items-center min-w-0 gap-1">
        <Button
          full
          className="justify-start min-w-0 h-auto py-3 text-left"
          disabled={busy}
          variant={active ? "secondary" : "ghost"}
          onClick={onOpen}
        >
          <span className="truncate">{thread.title}</span>
        </Button>
        <Button
          ref={trigger}
          size="sm"
          variant="ghost"
          icon="more"
          aria-label={t("ask.options")}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={busy}
          onClick={() => setOpen(!open)}
        />
      </div>
      {menu.rendered && (
        <div data-state={menu.state} className="collapse-grid" inert={menu.closing} aria-hidden={menu.closing || undefined}>
        <div>
        <div
          role="menu"
          aria-label={t("ask.options")}
          className="rounded-md border border-line bg-surface p-1 shadow-card"
        >
          <Button
            ref={item}
            role="menuitem"
            variant="ghost"
            icon="trash"
            full
            className="justify-start text-danger"
            onClick={() => {
              trigger.current?.focus();
              setOpen(false);
              onDelete();
            }}
          >
            {t("ai.deleteChat")}
          </Button>
        </div>
        </div>
        </div>
      )}
    </div>
  );
}
