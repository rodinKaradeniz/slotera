"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { useToast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/time";
import {
  listClientNotes,
  createClientNote,
  updateClientNote,
  deleteClientNote,
} from "@/services/client-notes.service";
import type { ClientNote } from "@/types/client-note";

const NOTES_HELP =
  "Use notes for internal context, follow-up reminders, preferences, or details you want to remember before future sessions. Notes are internal and are not shown to clients.";

export function ClientNotes({ clientId }: { clientId: string }) {
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

  React.useEffect(() => {
    let live = true;
    listClientNotes(clientId).then((n) => {
      if (live) setNotes(n);
    });
    return () => {
      live = false;
    };
  }, [clientId, reload]);

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

  const closeModal = () => {
    setEditing(null);
    setSaving(false);
  };

  const titleError = touched && !title.trim() ? "A title is required." : "";
  const bodyError = touched && !body.trim() ? "A note is required." : "";
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
          body: body.trim(),
        });
        toast.success("Note added");
      } else {
        await updateClientNote(editing.id, {
          title: title.trim(),
          body: body.trim(),
        });
        toast.success("Note saved");
      }
      setReload((k) => k + 1);
      closeModal();
    } catch (err) {
      setSaving(false);
      toast.error("Couldn't save note", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteClientNote(pendingDelete.id);
      setReload((k) => k + 1);
      toast.success("Note deleted");
      setPendingDelete(null);
    } catch (err) {
      toast.error("Couldn't delete note", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card padded>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-h3 text-ink" style={{ fontSize: 16 }}>
              Notes
            </h3>
            <span
              className="text-ink-3 inline-flex"
              tabIndex={0}
              role="note"
              aria-label={NOTES_HELP}
              title={NOTES_HELP}
            >
              <Icon name="info" size={15} />
            </span>
          </div>
          <Button variant="secondary" size="sm" icon="plus" onClick={openNew}>
            Add note
          </Button>
        </div>
        <p className="text-small text-ink-3 mb-4 max-w-prose">
          Internal context only — notes are never shown to clients. Use them for
          follow-up reminders, preferences, and prep details.
        </p>

        {!notes ? (
          <LoadingRows count={2} />
        ) : notes.length === 0 ? (
          <div className="text-small text-ink-3 border border-dashed border-line rounded-lg px-5 py-8 text-center">
            No notes yet. Add context you want to remember before future
            sessions.
          </div>
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
                    <p className="text-body text-ink-2 whitespace-pre-wrap mt-1">
                      {note.body}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="edit"
                      aria-label="Edit note"
                      onClick={() => openEdit(note)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      aria-label="Delete note"
                      onClick={() => setPendingDelete(note)}
                    />
                  </div>
                </div>
                <div className="text-micro text-ink-3 mt-3">
                  {note.updatedAtISO !== note.createdAtISO
                    ? `Updated ${fmtDate(new Date(note.updatedAtISO), "short")}`
                    : `Added ${fmtDate(new Date(note.createdAtISO), "short")}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={closeModal}
        title={editing === "new" ? "Add note" : "Edit note"}
        description="Internal note — not shown to clients."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={save}
              disabled={saving}
            >
              {editing === "new" ? "Add note" : "Save note"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Title" required error={titleError}>
            <Input
              value={title}
              placeholder="e.g. Prefers morning sessions"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Note" required error={bodyError}>
            <Textarea
              value={body}
              rows={5}
              placeholder="Context, reminders, or details to remember before the next session…"
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete note?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
      />
    </>
  );
}
