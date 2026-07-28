"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  createActionItem,
  deleteActionItem,
  toggleActionItemStatus,
  updateActionItem,
} from "@/services/session-action-items.service";
import type { SessionActionItem } from "@/types/session-action-item";

type Props = {
  sessionId: string;
  items: SessionActionItem[];
  /** Lets the drawer keep its open-count badge in sync with edits here. */
  onChange: (items: SessionActionItem[]) => void;
  loading?: boolean;
};

type DraftFields = {
  title: string;
  description: string;
  dueDate: string;
  clientVisible: boolean;
};

const EMPTY_DRAFT: DraftFields = {
  title: "",
  description: "",
  dueDate: "",
  clientVisible: false,
};

/**
 * Admin-side action-item manager rendered inside SessionDrawer's "Notes &
 * Actions" tab. Lightweight by design: add / edit / mark done / delete and an
 * optional due date + "Visible to client" toggle. `clientVisible` flags an
 * item for a future client-facing surface; it is admin-only today. No
 * assignees, comments, reminders, or recurrence.
 */
export function SessionActionItems({ sessionId, items, onChange, loading }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = React.useState<DraftFields>(EMPTY_DRAFT);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<DraftFields>(EMPTY_DRAFT);
  const [busy, setBusy] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<SessionActionItem | null>(
    null,
  );

  const sorted = React.useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.status !== b.status) return a.status === "done" ? 1 : -1;
        return a.createdAtISO.localeCompare(b.createdAtISO);
      }),
    [items],
  );

  const add = async () => {
    const title = draft.title.trim();
    if (title.length === 0) return;
    setBusy(true);
    try {
      const created = await createActionItem({
        sessionId,
        title,
        description: draft.description.trim() || undefined,
        status: "todo",
        dueDate: draft.dueDate || undefined,
        clientVisible: draft.clientVisible,
      });
      onChange([...items, created]);
      setDraft(EMPTY_DRAFT);
      toast.success("Action item added");
    } catch (err) {
      toast.error("Couldn't add action item", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: SessionActionItem) => {
    // Optimistic flip — feels instant, rolls back on failure.
    const snapshot = items;
    onChange(
      items.map((i) =>
        i.id === item.id
          ? { ...i, status: i.status === "done" ? "todo" : "done" }
          : i,
      ),
    );
    try {
      await toggleActionItemStatus(item.id);
    } catch (err) {
      onChange(snapshot);
      toast.error("Couldn't update item", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const toggleVisibility = async (item: SessionActionItem) => {
    const snapshot = items;
    const nextVisible = !item.clientVisible;
    onChange(
      items.map((i) =>
        i.id === item.id ? { ...i, clientVisible: nextVisible } : i,
      ),
    );
    try {
      await updateActionItem(item.id, { clientVisible: nextVisible });
    } catch (err) {
      onChange(snapshot);
      toast.error("Couldn't update item", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const startEdit = (item: SessionActionItem) => {
    setEditingId(item.id);
    setEditDraft({
      title: item.title,
      description: item.description ?? "",
      dueDate: item.dueDate ?? "",
      clientVisible: item.clientVisible ?? false,
    });
  };

  const saveEdit = async (item: SessionActionItem) => {
    const title = editDraft.title.trim();
    if (title.length === 0) return;
    setBusy(true);
    try {
      const next = await updateActionItem(item.id, {
        title,
        description: editDraft.description.trim() || undefined,
        dueDate: editDraft.dueDate || undefined,
        clientVisible: editDraft.clientVisible,
      });
      onChange(items.map((i) => (i.id === item.id ? next : i)));
      setEditingId(null);
      toast.success("Action item updated");
    } catch (err) {
      toast.error("Couldn't update action item", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteActionItem(pendingDelete.id);
      onChange(items.filter((i) => i.id !== pendingDelete.id));
      setPendingDelete(null);
      toast.success("Action item removed");
    } catch (err) {
      toast.error("Couldn't remove action item", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="text-[13px] font-semibold text-ink">Action items</h4>
        <p className="text-micro text-ink-3 mt-0.5">
          Track pre/post-session tasks. “Visible to client” flags an item for a
          future client-facing surface — it stays admin-only for now.
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton h={44} />
          <Skeleton h={44} />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-md border border-dashed border-line p-5 text-small text-center text-ink-3">
          No action items yet. Add the first task below.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((item) => {
            const isEditing = editingId === item.id;
            const done = item.status === "done";
            return (
              <li
                key={item.id}
                className="rounded-md border border-line-soft bg-surface px-3 py-2.5"
              >
                {isEditing ? (
                  <div className="flex flex-col gap-2.5">
                    <Input
                      value={editDraft.title}
                      placeholder="Task title"
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, title: e.target.value })
                      }
                    />
                    <Input
                      value={editDraft.description}
                      placeholder="Description (optional)"
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, description: e.target.value })
                      }
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <Input
                        type="date"
                        value={editDraft.dueDate}
                        className="w-auto"
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, dueDate: e.target.value })
                        }
                      />
                      <label className="flex items-center gap-2 text-small text-ink-2 select-none">
                        <Toggle
                          size="sm"
                          checked={editDraft.clientVisible}
                          onChange={(v) =>
                            setEditDraft({ ...editDraft, clientVisible: v })
                          }
                          aria-label="Visible to client"
                        />
                        Visible to client
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(item)}
                        loading={busy}
                        disabled={editDraft.title.trim().length === 0}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      aria-label={done ? "Mark as to do" : "Mark as done"}
                      className={cn(
                        "mt-0.5 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors",
                        done
                          ? "bg-accent border-accent text-white"
                          : "border-line hover:border-ink-3",
                      )}
                    >
                      {done && <Icon name="check" size={12} strokeWidth={2.5} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "text-[14px] text-ink",
                          done && "line-through text-ink-3",
                        )}
                      >
                        {item.title}
                      </div>
                      {item.description && (
                        <p className="text-small text-ink-3 mt-0.5">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {item.clientVisible && (
                          <Pill tone="accent" icon="user">
                            Visible to client
                          </Pill>
                        )}
                        {item.dueDate && (
                          <Pill tone="neutral" icon="calendar">
                            Due {item.dueDate}
                          </Pill>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleVisibility(item)}
                        aria-label={
                          item.clientVisible
                            ? "Hide from client"
                            : "Share with client"
                        }
                        title={
                          item.clientVisible
                            ? "Hide from client"
                            : "Share with client"
                        }
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                          item.clientVisible
                            ? "text-accent hover:bg-paper-2"
                            : "text-ink-4 hover:text-ink-2 hover:bg-paper-2",
                        )}
                      >
                        <Icon name="eye" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label="Edit"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-ink-4 hover:text-ink-2 hover:bg-paper-2 transition-colors"
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        aria-label="Remove"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-ink-4 hover:text-danger hover:bg-paper-2 transition-colors"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Add */}
      <div className="rounded-md border border-line-soft bg-surface-warm p-3 flex flex-col gap-2.5">
        <Input
          value={draft.title}
          placeholder="Add an action item…"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            type="date"
            value={draft.dueDate}
            className="w-auto"
            aria-label="Due date"
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
          />
          <label className="flex items-center gap-2 text-small text-ink-2 select-none">
            <Toggle
              size="sm"
              checked={draft.clientVisible}
              onChange={(v) => setDraft({ ...draft, clientVisible: v })}
              aria-label="Visible to client"
            />
            Visible to client
          </label>
          <Button
            size="sm"
            icon="plus"
            className="ml-auto"
            onClick={add}
            loading={busy && editingId === null}
            disabled={draft.title.trim().length === 0}
          >
            Add
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => !busy && setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Remove this action item?"
        description="This task will be deleted. This can't be undone."
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        busy={busy}
      />
    </div>
  );
}
