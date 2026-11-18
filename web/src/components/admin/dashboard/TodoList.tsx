"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Textarea } from "@/components/ui/Textarea";
import { CardHead } from "@/components/shared/CardHead";
import { RecoverableError, toError } from "@/components/shared/RecoverableError";
import { usePagedHistory } from "@/lib/use-paged-history";
import { useLeavingRows } from "@/lib/use-leaving-rows";
import { useHeightTransition } from "@/lib/use-height-transition";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { cn } from "@/lib/cn";
import { createActionItem, listTodoPage, toggleActionItemStatus } from "@/services/session-action-items.service";
import type { SessionActionItem } from "@/types/session-action-item";

export function TodoList({ className }: { className?: string }) {
  const { t } = useI18n();
  const tasks = usePagedHistory("dashboard-todo", listTodoPage);
  const rows = useLeavingRows(tasks.items, (item) => item.id);
  const [optimistic, setOptimistic] = React.useState<Record<string, {version?: number; done: boolean}>>({});
  const [busy, setBusy] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const checked = (item: SessionActionItem) => optimistic[item.id]?.version === item.version
    ? optimistic[item.id]?.done ?? (item.status === "done") : item.status === "done";
  async function toggle(item: SessionActionItem) {
    if (busy) return;
    setBusy(true);
    setOptimistic((old) => ({...old, [item.id]: {version: item.version, done: !checked(item)}}));
    setError(null);
    try {
      await toggleActionItemStatus(item.id, checked(item) ? "done" : "todo", item.version);
      tasks.reload();
    } catch (cause) {
      setOptimistic((old) => { const next = {...old}; delete next[item.id]; return next; });
      setError(toError(cause));
      tasks.reload();
    } finally { setBusy(false); }
  }
  return (
    <Card padded={false} className={cn("flex flex-col min-h-0 max-lg:max-h-[28rem]", className)} aria-label={t("todo.title")}>
      <CardHead
        title={t("todo.title")}
        right={<Button size="sm" variant="ghost" icon="plus" onClick={() => setCreating(true)} aria-label={t("todo.new")}>{t("todo.new.short")}</Button>}
      />
      <div className="px-5 pt-3 empty:hidden">
        <RecoverableError error={error ?? tasks.error} />
        {tasks.error && <Button variant="ghost" onClick={tasks.reload}>{t("ui.try.again")}</Button>}
      </div>
      {tasks.loading && !tasks.items.length && <p role="status" className="px-5 py-4 text-small">{t("common.loading")}</p>}
      {!tasks.loading && !tasks.error && !tasks.items.length && <p className="px-5 py-4 text-small">{t("ui.all.caught.up")}</p>}
      {/* The list scrolls inside the card, so expanding a row never changes the card's size. */}
      <ScrollArea onScroll={(event) => {
        const node = event.currentTarget;
        if (node.scrollHeight - node.scrollTop - node.clientHeight < 40) void tasks.more();
      }}>
        <ul className="list-rise">
          {rows.map(({ item, leaving }) => (
            <li key={item.id} className="row-shell" data-state={leaving ? "closed" : "open"} inert={leaving}>
              <div>
                <TodoRow
                  item={item}
                  done={checked(item)}
                  busy={busy}
                  expanded={expanded === item.id}
                  onToggle={() => void toggle(item)}
                  onExpand={() => setExpanded((current) => (current === item.id ? null : item.id))}
                />
              </div>
            </li>
          ))}
        </ul>
        {tasks.paging && <p role="status" className="px-5 py-3 text-small">{t("common.loading")}</p>}
      </ScrollArea>
      <NewTodoModal open={creating} onClose={() => setCreating(false)} onCreated={tasks.reload} />
    </Card>
  );
}

function TodoRow({
  item,
  done,
  busy,
  expanded,
  onToggle,
  onExpand,
}: {
  item: SessionActionItem;
  done: boolean;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const { t } = useI18n();
  const titleId = React.useId();
  const description = item.description?.trim();
  const body = useHeightTransition<HTMLParagraphElement>(expanded);
  return (
    <div className="group flex items-start gap-3 px-5 py-3 border-b border-line-soft">
      <Checkbox checked={done} disabled={busy} onChange={onToggle} aria-labelledby={titleId} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p id={titleId} className={cn("text-[14px] text-ink break-words transition-colors duration-(--d-fade) ease-out", done && "line-through text-ink-3")}>
          {item.title}
        </p>
        {description && (
          <p
            ref={body}
            className={cn(
              "overflow-hidden text-[12.5px] text-ink-3 mt-0.5",
              expanded ? "whitespace-pre-line break-words" : "truncate",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {description && (
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={t(expanded ? "todo.collapse" : "todo.expand")}
          className={cn(
            "press shrink-0 -my-1 p-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-paper-2",
            // Shown on hover or focus; touch screens without hover always show it.
            "opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            expanded && "[@media(hover:hover)]:opacity-100",
          )}
        >
          <Icon
            name="chevron-d"
            size={16}
            className={cn("transition-transform duration-(--d-collapse) ease-out motion-reduce:transition-none", expanded && "rotate-180")}
          />
        </button>
      )}
    </div>
  );
}

function NewTodoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);
  useResetOnOpen(open, [], () => {
    setTitle("");
    setDescription("");
    setError(null);
  });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createActionItem({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        status: "todo",
      });
      onCreated();
      onClose();
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setBusy(false);
    }
  }
  const formId = React.useId();
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("todo.new")}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("ui.cancel")}</Button>
          <Button type="submit" form={formId} loading={busy}>{t("todo.add.button")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("todo.field.title")} required>
          <Input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} autoFocus />
        </Field>
        <Field label={t("todo.field.description")} optional>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} />
        </Field>
        <RecoverableError error={error} />
      </form>
    </Modal>
  );
}
