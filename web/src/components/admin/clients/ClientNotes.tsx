"use client";
import { DATA_CHANGED } from "@/api/query-cache";
import { Pagination } from "@/components/shared/Pagination";
import { LoadError } from "@/components/shared/LoadError";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useReviewedEdit } from "@/components/shared/use-reviewed-edit";
import { getClientNote } from "@/services/client-notes.service";
import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { useToast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/time";
import { NoteContent } from "./NoteContent";
import { NoteEditor } from "./NoteEditor";
import {
  listClientNotePage,
  createClientNote,
  updateClientNote,
  deleteClientNote,
} from "@/services/client-notes.service";
import type { ClientNote } from "@/types/client-note";

export function ClientNotes({ clientId }: { clientId: string }) {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [notes, setNotes] = React.useState<ClientNote[] | null>(null);
  const [reload, setReload] = React.useState(0);

  // Add / edit modal
  const [editing, setEditing] = React.useState<ClientNote | "new" | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = React.useState<ClientNote | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);

  const [offset, setOffset] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const refresh = () => setReload((value) => value + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => window.removeEventListener(DATA_CHANGED, refresh);
  }, []);
  React.useEffect(() => {
    const controller = new AbortController();
    listClientNotePage(clientId, offset, controller.signal).then((page) => {
      if (!controller.signal.aborted) {setNotes(page.items); setTotal(page.total); setLoadError(null);}
    }).catch((error: Error) => {if (!controller.signal.aborted) setLoadError(error.message);});
    return () => controller.abort();
  }, [clientId, reload, offset]);

  const openNew = () => {
    setEditing("new");
    setTitle("");
    setBody("");
    setTouched(false);
  };

  const openEdit = (note: ClientNote) => {
    setEditing(note);
    setTitle(note.title);
    setBody(note.body);
    setTouched(false);
  };

  const edit = useReviewedEdit(editing !== null && editing !== "new", typeof editing === "object" ? editing : null, getClientNote, (latest) => {
    setEditing(latest); setTitle(latest.title); setBody(latest.body);
  });

  const closeModal = () => {
    setEditing(null);
    setSaving(false);
  };

  const titleError = touched && !title.trim() ? uiText("ui.a.title.is.required") : "";
  const bodyError = touched && !body.trim() ? uiText("ui.a.note.is.required") : "";
  const canSave = title.trim().length > 0 && body.trim().length > 0;

  const save = async () => {
    setTouched(true);
    if (!canSave || !editing) return;
    setSaving(true);
    try {
      if (editing === "new") {
        await createClientNote({
          clientId,
          title: title.trim(),
          body,
        });
        toast.success(uiText("ui.note.added"));
      } else {
        await updateClientNote(editing.id, {
          title: title.trim(),
          body,
        }, edit.version);
        toast.success(uiText("ui.note.saved"));
      }
      setReload((k) => k + 1);
      closeModal();
    } catch (err) {
      edit.onError(err);
      setSaving(false);
      toast.error(uiText("ui.couldn.t.save.note"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteClientNote(pendingDelete.id, pendingDelete.version);
      setReload((k) => k + 1);
      toast.success(uiText("ui.note.deleted"));
      setPendingDelete(null);
    } catch (err) {
      if (edit.onError(err)) {setPendingDelete(null); setReload((value) => value + 1);}
      toast.error(uiText("ui.couldn.t.delete.note"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {loadError && <LoadError message={loadError} onRetry={() => setReload((n) => n + 1)} />}
      <Card padded>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-h3 text-ink" style={{ fontSize: 16 }}>
            {uiText("ui.notes")}</h3>
          <Button variant="secondary" size="sm" icon="plus" onClick={openNew}>
            {uiText("ui.add.note")}</Button>
        </div>

        {!notes ? (
          <LoadingRows count={2} />
        ) : notes.length === 0 ? (
          <div className="text-small text-ink-3 border border-dashed border-line rounded-lg px-5 py-8 text-center">
            {uiText("ui.no.notes.yet.add.context.you.want.to.remember.before.future.sessions")}</div>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-lg border border-line-soft bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium text-ink">
                      {note.title}
                    </div>
                    <NoteContent html={note.body} className="mt-1" />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="edit"
                      aria-label={uiText("ui.edit.note")}
                      onClick={() => openEdit(note)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      aria-label={uiText("ui.delete.note")}
                      onClick={() => setPendingDelete(note)}
                    />
                  </div>
                </div>
                <div className="text-micro text-ink-3 mt-3">
                  {note.updatedAtISO !== note.createdAtISO
                    ? uiText("ui.note.updated", { date: fmtDate(new Date(note.updatedAtISO), "short") })
                    : uiText("ui.note.added", { date: fmtDate(new Date(note.createdAtISO), "short") })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pagination total={total} offset={offset} onChange={setOffset} />
      <Modal
        open={editing !== null}
        onClose={closeModal}
        title={editing === "new" ? uiText("ui.add.note") : uiText("ui.edit.note")}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={closeModal}>
              {uiText("ui.cancel")}</Button>
            <Button
              variant="primary"
              size="md"
              onClick={save}
              disabled={saving}
            >
              {editing === "new" ? uiText("ui.add.note") : uiText("ui.save.note")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {edit.notice}
        <Field label={uiText("ui.title")} required error={titleError}>
            <Input
              value={title}
              placeholder={uiText("ui.e.g.prefers.morning.sessions")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={uiText("ui.note")} required error={bodyError}>
            <div className="flex flex-col gap-1.5">
              <NoteEditor
                value={body}
                onChange={setBody}
                invalid={!!bodyError}
                placeholder={uiText("ui.write.a.note.about.this.client")}
              />
              <p className="text-micro text-ink-3">
                {uiText("ui.format.visually.as.you.type.bold.italic.headings.lists.and.quotes.notes.are.internal.and.n")}</p>
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={uiText("ui.delete.note")}
        description={
          pendingDelete
            ? uiText("ui.remove.note", { name: pendingDelete.title })
            : undefined
        }
        confirmLabel={uiText("ui.delete")}
        destructive
        busy={deleting}
      />
    </>
  );
}
