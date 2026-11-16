"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { ApiRequestError } from "@/services/_errors";
import { localeForLang } from "@/lib/i18n";
import { useReviewedEdit } from "@/components/shared/use-reviewed-edit";
import { getActionItem } from "@/services/session-action-items.service";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
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
  sessionId?: string;
  items: SessionActionItem[];
  /** Lets the drawer keep its open-count badge in sync with edits here. */
  onChange: (items: SessionActionItem[]) => void;
  loading?: boolean;
  allowCreate?: boolean;
  onOpenSession?: (id: string) => void;
};

type DraftFields = {
  version?: number;
  title: string;
  description: string;
  dueDate: string;
};

const EMPTY_DRAFT: DraftFields = {
  title: "",
  description: "",
  dueDate: "",
};

/**
 * Admin-side action-item manager rendered inside SessionDrawer's "Notes &
 * Actions" tab. Private add / edit / mark done / delete controls, with no
 * assignees, comments, reminders, or recurrence.
 */
export function SessionActionItems({
  sessionId,
  items,
  onChange,
  loading,
  allowCreate = true,
  onOpenSession,
}: Props) {
  const { t: uiText, lang } = useI18n();
  const { toast } = useToast();
  const [draft, setDraft] = React.useState<DraftFields>(EMPTY_DRAFT);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<DraftFields>(EMPTY_DRAFT);
  const [busy, setBusy] = React.useState(false);
  const [pendingDelete, setPendingDelete] =
    React.useState<SessionActionItem | null>(null);

  const editingItem = items.find((item) => item.id === editingId);
  const edit = useReviewedEdit(
    editingId !== null,
    editingItem ? { ...editingItem, version: editDraft.version } : null,
    getActionItem,
    (latest) => {
      setEditDraft({
        version: latest.version,
        title: latest.title,
        description: latest.description ?? "",
        dueDate: latest.dueDate ?? "",
      });
      onChange(items.map((item) => (item.id === latest.id ? latest : item)));
    },
  );

  const sorted = React.useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.status !== b.status) return a.status === "done" ? 1 : -1;
        return (
          (a.dueDate ?? "9999-12-31").localeCompare(
            b.dueDate ?? "9999-12-31",
          ) ||
          a.createdAtISO.localeCompare(b.createdAtISO) ||
          a.id.localeCompare(b.id)
        );
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
      });
      onChange([...items, created]);
      setDraft(EMPTY_DRAFT);
      toast.success(uiText("ui.action.item.added"));
    } catch (err) {
      edit.onError(err);
      toast.error(uiText("ui.couldn.t.add.action.item"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: SessionActionItem) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await toggleActionItemStatus(
        item.id,
        item.status,
        item.version,
      );
      onChange(
        items.map((current) => (current.id === next.id ? next : current)),
      );
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "resource_stale") {
        void getActionItem(item.id)
          .then((latest) =>
            onChange(
              latest
                ? items.map((current) =>
                    current.id === latest.id ? latest : current,
                  )
                : items.filter((current) => current.id !== item.id),
            ),
          )
          .catch(() => undefined);
      }
      toast.error(uiText("ui.couldn.t.update.item"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item: SessionActionItem) => {
    setEditingId(item.id);
    setEditDraft({
      version: item.version,
      title: item.title,
      description: item.description ?? "",
      dueDate: item.dueDate ?? "",
    });
  };

  const saveEdit = async (item: SessionActionItem) => {
    const title = editDraft.title.trim();
    if (title.length === 0) return;
    setBusy(true);
    try {
      const next = await updateActionItem(
        item.id,
        {
          title,
          description: editDraft.description.trim() || undefined,
          dueDate: editDraft.dueDate || undefined,
        },
        edit.version,
      );
      onChange(items.map((i) => (i.id === item.id ? next : i)));
      setEditingId(null);
      toast.success(uiText("ui.action.item.updated"));
    } catch (err) {
      edit.onError(err);
      toast.error(uiText("ui.couldn.t.update.action.item"), {
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
      await deleteActionItem(pendingDelete.id, pendingDelete.version);
      onChange(items.filter((i) => i.id !== pendingDelete.id));
      setPendingDelete(null);
      toast.success(uiText("ui.action.item.removed"));
    } catch (err) {
      if (edit.onError(err)) {
        setPendingDelete(null);
        const latest = await getActionItem(pendingDelete.id);
        onChange(
          latest
            ? items.map((item) => (item.id === latest.id ? latest : item))
            : items.filter((item) => item.id !== pendingDelete.id),
        );
      }
      toast.error(uiText("ui.couldn.t.remove.action.item"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {edit.notice}
      <div>
        <h4 className="text-[13px] font-semibold text-ink">
          {uiText("ui.action.items")}
        </h4>
        <p className="text-micro text-ink-3 mt-0.5">
          {uiText(
            "ui.track.pre.post.session.tasks.visible.to.client.flags.an.item.for.a.future.client.facing.su",
          )}
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
          {uiText("ui.no.action.items.yet.add.the.first.task.below")}
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
                      placeholder={uiText("ui.task.title")}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, title: e.target.value })
                      }
                    />
                    <Input
                      value={editDraft.description}
                      placeholder={uiText("ui.description.optional")}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          description: e.target.value,
                        })
                      }
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <Input
                        type="date"
                        value={editDraft.dueDate}
                        className="w-auto"
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            dueDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                      >
                        {uiText("ui.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(item)}
                        loading={busy}
                        disabled={editDraft.title.trim().length === 0}
                      >
                        {uiText("ui.save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      aria-label={
                        done
                          ? uiText("ui.mark.as.to.do")
                          : uiText("ui.mark.as.done")
                      }
                      className={cn(
                        "mt-0.5 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors",
                        done
                          ? "bg-accent border-accent text-white"
                          : "border-line hover:border-ink-3",
                      )}
                    >
                      {done && (
                        <Icon name="check" size={12} strokeWidth={2.5} />
                      )}
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
                        {item.sessionId && onOpenSession && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenSession(item.sessionId!)}
                          >
                            {uiText("ui.session")}
                          </Button>
                        )}
                        {item.dueDate && (
                          <Pill tone="neutral" icon="calendar">
                            {uiText("ui.due")}{" "}
                            {new Intl.DateTimeFormat(localeForLang(lang), {
                              dateStyle: "medium",
                              timeZone: "UTC",
                            }).format(new Date(`${item.dueDate}T00:00:00Z`))}
                          </Pill>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label={uiText("ui.edit")}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-ink-4 hover:text-ink-2 hover:bg-paper-2 transition-colors"
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        aria-label={uiText("ui.remove")}
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
      {allowCreate && (
        <div className="rounded-md border border-line-soft bg-surface-warm p-3 flex flex-col gap-2.5">
          <Input
            value={draft.title}
            placeholder={uiText("ui.add.an.action.item")}
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
              aria-label={uiText("ui.due.date")}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
            <Button
              size="sm"
              icon="plus"
              className="ml-auto"
              onClick={add}
              loading={busy && editingId === null}
              disabled={draft.title.trim().length === 0}
            >
              {uiText("ui.add")}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => !busy && setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={uiText("ui.remove.this.action.item")}
        description={uiText(
          "ui.this.task.will.be.deleted.this.can.t.be.undone",
        )}
        confirmLabel={uiText("ui.remove")}
        cancelLabel={uiText("ui.keep")}
        destructive
        busy={busy}
      />
    </div>
  );
}
