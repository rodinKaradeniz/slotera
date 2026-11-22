"use client";
import { ApiRequestError } from "@/services/_errors";
import { DATA_CHANGED } from "@/api/query-cache";
import { useReviewedEdit } from "@/components/shared/use-reviewed-edit";
import { Pagination } from "@/components/shared/Pagination";
import { LoadError } from "@/components/shared/LoadError";
import { useI18n } from "@/components/i18n/I18nProvider";

import { getSession } from "@/services/sessions.service";
import * as React from "react";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { AttendanceTab } from "./AttendanceTab";
import { SessionDetailsForm, emptyForm, toForm, type FormState } from "./SessionDetailsForm";
import { useDrawers } from "./DrawersProvider";
import { SessionActionItems } from "./SessionActionItems";
import {
  createSession,
  updateSession,
  cancelSession,
  findConflict,
  previewSessionChange,
  type SessionImpact,
  type SessionReview,
  type SessionUpdateScope,
} from "@/services/sessions.service";
import { listServicePage, getService } from "@/services/services.service";
import { listWorkspaceLocations } from "@/services/settings.service";
import { listActionItemPage } from "@/services/session-action-items.service";
import { localeForLang } from "@/lib/i18n";
import { zonedWallToISO } from "@/lib/calendar";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";
import type { SessionActionItem } from "@/types/session-action-item";
import type { WorkspaceLocation } from "@/types/address";

export type SessionDrawerMode = "view" | "edit";

export type SessionDrawerProps = {
  open: boolean;
  onClose: () => void;
  initial?: SessionItem | null;
  mode?: SessionDrawerMode;
  onSaved?: (s: SessionItem) => void;
  onCancelled?: (s: SessionItem) => void;
};


export function SessionDrawer({
  open,
  onClose,
  initial,
  mode: modeProp = "edit",
  onSaved,
  onCancelled,
}: SessionDrawerProps) {
  const { t: uiText, lang } = useI18n();
  const isEdit = !!initial;
  const { toast } = useToast();
  const timezone = useWorkspaceTimezone();
  const [mode, setMode] = React.useState<SessionDrawerMode>(modeProp);
  const { openBookingDrawer } = useDrawers();
  const isView = mode === "view" && isEdit;
  const [serviceSearch, setServiceSearch] = React.useState("");
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [lookupAttempt, setLookupAttempt] = React.useState(0);
  const [services, setServices] = React.useState<Service[]>([]);
  const [savedLocations, setSavedLocations] = React.useState<WorkspaceLocation[]>(
    [],
  );
  const [form, setForm] = React.useState<FormState>(() => emptyForm([]));
  const edit = useReviewedEdit(open, initial, getSession, (item) => {
    setForm(toForm(item, services, timezone)); onSaved?.(item);
  });
  const [conflict, setConflict] = React.useState<SessionItem | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [scope, setScope] = React.useState<SessionUpdateScope>("this");
  const [review, setReview] = React.useState<{action: "save" | "note" | "cancel"; impact: SessionImpact; command: SessionReview; latest: SessionItem} | null>(null);
  const [changeError, setChangeError] = React.useState<string | null>(null);
  const requestReview = async (action: "save" | "note" | "cancel") => {
    if (!initial) return;
    setBusy(true); setChangeError(null);
    try {
      const [impact, latest] = await Promise.all([previewSessionChange(initial.id, action === "note" ? "this" : scope), getSession(initial.id, true)]);
      if (!latest) throw new Error(uiText("ui.couldn.t.save.session"));
      setReview({action, impact, latest, command: {impactRevision: impact.revision, idempotencyKey: crypto.randomUUID()}});
    } catch (cause) {setChangeError(cause instanceof Error ? cause.message : String(cause));}
    finally {setBusy(false);}
  };
  const [savingNote, setSavingNote] = React.useState(false);
  // Tabs appear for an existing session: "Notes & Actions" is always available,
  // "Attendance" only for a group session. New / 1:1 sessions render the details
  // body directly and keep notes inline in the details form.
  const canShowAttendance =
    isEdit && (initial?.capacity ?? 0) > 1;
  const canShowActionItems = isEdit;
  const showTabs = isEdit;
  const [tab, setTab] = React.useState<"details" | "notes" | "attendance">(
    "details",
  );
  // Action items of the open session, tagged with its id; none yet means loading.
  const [loadedActionItems, setLoadedActionItems] = React.useState<{
    sessionId: string;
    items: SessionActionItem[];
    total: number;
  } | null>(null);
  const [actionOffset, setActionOffset] = React.useState(0);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionAttempt, setActionAttempt] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    const refresh = () => setActionAttempt((value) => value + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => window.removeEventListener(DATA_CHANGED, refresh);
  }, [open]);
  const actionItemsReady =
    !!initial && loadedActionItems?.sessionId === initial.id;
  const actionItems = actionItemsReady ? loadedActionItems.items : [];
  const actionItemsLoading = open && !!initial && !actionItemsReady;
  const setActionItems = (items: SessionActionItem[]) => {
    if (initial) setLoadedActionItems({ sessionId: initial.id, items, total: (loadedActionItems?.total ?? 0) + items.length - actionItems.length });
  };
  const openActionCount = actionItems.filter((a) => a.status === "todo").length;

  useResetOnOpen(open, [modeProp], () => {
    setScope("this"); setReview(null); setChangeError(null);
    setMode(modeProp);
    setTab("details");
    // Reopening refetches the action items instead of showing the last copy.
    setLoadedActionItems(null); setActionOffset(0);
  });

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    const controller = new AbortController();
    Promise.all([listServicePage({search: serviceSearch, status: "active"}, controller.signal), listWorkspaceLocations(), form.serviceId ? getService(form.serviceId) : null]).then(([page, locations, selected]) => {
      if (live) {
        const catalog = [...new Map([...page.items, ...(selected ? [selected] : [])].map((item) => [item.id, item])).values()];
        setServices(catalog); setSavedLocations(locations); setLookupError(null);

      }
    }).catch((cause: unknown) => { if (live) setLookupError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { live = false; controller.abort(); };
  }, [open, serviceSearch, form.serviceId, initial, lookupAttempt]);

  const actionSessionId = initial?.id;
  React.useEffect(() => {
    if (!open || !actionSessionId) return;
    const sessionId = actionSessionId;
    const controller = new AbortController();
    listActionItemPage(sessionId, actionOffset, controller.signal).then((page) => {
      if (!controller.signal.aborted) {setLoadedActionItems({sessionId, items: page.items, total: page.total}); setActionError(null);}
    }).catch((error: Error) => {if (!controller.signal.aborted) setActionError(error.message);});
    return () => controller.abort();
  }, [open, actionSessionId, actionOffset, actionAttempt]);

  useResetOnOpen(open, [initial?.id], () => {
    setServiceSearch("");
    setForm(initial ? toForm(initial, services, timezone) : emptyForm(services));
    setConflict(null);
  });

  const startISO = React.useMemo(() => {
    return zonedWallToISO(form.date, form.time, timezone);
  }, [form.date, form.time, timezone]);

  const endISO = React.useMemo(() => {
    return new Date(Date.parse(startISO) + form.durationMin * 60000).toISOString();
  }, [startISO, form.durationMin]);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    findConflict({ startISO, endISO, id: initial?.id })
      .then((c) => {
        if (live) setConflict(c);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, startISO, endISO, initial?.id]);

  const save = async () => {
    setBusy(true);
    try {
      // Drop the address entirely if the session went online — keeps the
      // SessionItem clean and avoids carrying stale physical-address data.
      const addressOnSave =
        form.locationType === "online" ? undefined : form.address;
      if (isEdit && initial) {
        const next = await updateSession(initial.id, {
          ...(scope === "this" ? {serviceId: form.serviceId} : {}),
          startISO,
          endISO,
          capacity: form.capacity,
          locationType: form.locationType,
          location: form.location,
          address: addressOnSave,
          notes: form.notes,
        }, scope, review?.latest.version, review?.latest.seriesVersion, review?.command);
        onSaved?.(next);
        toast.success(uiText("ui.session.updated"));
      } else {
        const next = await createSession({
          serviceId: form.serviceId,
          startISO,
          endISO,
          capacity: form.capacity,
          bookedCount: 0,
          status: form.status,
          locationType: form.locationType,
          location: form.location,
          address: addressOnSave,
          recurring: form.recurring,
          notes: form.notes,
        });
        onSaved?.(next);
        toast.success(uiText("ui.session.scheduled"));
      }
      onClose();
    } catch (err) {
      edit.onError(err);
      setChangeError(err instanceof Error ? err.message : String(err));
      if (err instanceof ApiRequestError && err.status === 409) setReview(null);
      toast.error(uiText("ui.couldn.t.save.session"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  // Internal note saves independently from the Notes & Actions tab (updateSession
  // is a patch merge, so the main Details "Save" stays consistent with this).
  const saveNote = async () => {
    if (!initial) return;
    setSavingNote(true);
    try {
      const next = await updateSession(initial.id, { notes: form.notes }, "this", review?.latest.version, review?.latest.seriesVersion, review?.command);
      setReview(null);
      edit.accept(next);
      onSaved?.(next);
      toast.success(uiText("ui.note.saved"));
    } catch (err) {
      edit.onError(err);
      setChangeError(err instanceof Error ? err.message : String(err));
      if (err instanceof ApiRequestError && err.status === 409) setReview(null);
      toast.error(uiText("ui.couldn.t.save.note"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingNote(false);
    }
  };

  const cancel = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      const next = await cancelSession(initial.id, review?.latest.version, scope, review?.latest.seriesVersion, review?.command);
      onCancelled?.(next);
      toast.success(uiText("ui.session.cancelled"));
      setReview(null);
      onClose();
    } catch (err) {
      edit.onError(err);
      setChangeError(err instanceof Error ? err.message : String(err));
      if (err instanceof ApiRequestError && err.status === 409) setReview(null);
      toast.error(uiText("ui.couldn.t.cancel.session"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const eyebrow = isView
    ? uiText("ui.session.details")
    : isEdit
      ? uiText("ui.edit.session")
      : uiText("ui.new.session");
  const title = isEdit ? `Session · ${initial?.id}` : uiText("ui.schedule.a.session");

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      footer={
        tab === "attendance" || tab === "notes" ? (
          <Button variant="ghost" onClick={onClose}>
            {uiText("ui.close")}</Button>
        ) : isView ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              {uiText("ui.close")}</Button>
            {initial?.status === "scheduled" && (
              <Button
                variant="secondary"
                icon="plus"
                onClick={() => openBookingDrawer({ defaultSessionId: initial.id, onSaved: async () => { const fresh = await getSession(initial.id); if (fresh) onSaved?.(fresh); } })}
              >
                {uiText("ui.add.attendee")}</Button>
            )}
            <Button icon="edit" disabled={initial?.status === "cancelled"} onClick={() => setMode("edit")}>
              {uiText("ui.edit.session")}</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {uiText("ui.cancel")}</Button>
            <Button onClick={isEdit ? () => requestReview("save") : save} loading={busy} disabled={!form.serviceId}>
              {isEdit ? uiText("ui.save.changes") : uiText("ui.create.session")}
            </Button>
          </>
        )
      }
    >
      {changeError && <p role="alert" className="mb-4 text-small text-danger">{changeError}</p>}
      {showTabs && (
        <div className="mb-5">
          {edit.notice}
      <Tabs
            value={tab}
            onChange={(v) => setTab(v as "details" | "notes" | "attendance")}
            tabs={[
              { value: "details", label: uiText("ui.details") },
              {
                value: "notes",
                label:
                  canShowActionItems && openActionCount > 0
                    ? uiText("ui.notes.actions.count", { count: openActionCount })
                    : canShowActionItems
                      ? uiText("ui.notes.actions")
                      : uiText("ui.internal.notes"),
              },
              ...(canShowAttendance
                ? [{ value: "attendance", label: uiText("ui.attendance") }]
                : []),
            ]}
          />
        </div>
      )}

      <TabPanel value={tab} order={["details", "notes", "attendance"]}>
      {tab === "notes" && initial ? (
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="text-[13px] font-semibold text-ink">{uiText("ui.internal.note")}</h4>
            <p className="text-micro text-ink-3 mt-0.5 mb-2">
              {uiText("ui.only.visible.to.you.session.specific.reminders.or.attendee.context")}</p>
            <Textarea
              value={form.notes}
              rows={3}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="mt-2 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                icon="check"
                onClick={() => requestReview("note")}
                loading={savingNote}
              >
                {uiText("ui.save.note")}</Button>
            </div>
          </div>

          {canShowActionItems && (
            <div className="border-t border-line-soft pt-5">
              {actionError && <LoadError message={actionError} onRetry={() => setActionAttempt((n) => n + 1)} />}
              <SessionActionItems
                sessionId={initial.id}
                items={actionItems}
                onChange={setActionItems}
                loading={actionItemsLoading}
              />
              <Pagination total={loadedActionItems?.total ?? 0} offset={actionOffset} onChange={setActionOffset} />
            </div>
          )}
        </div>
      ) : tab === "attendance" && initial ? (
        <AttendanceTab sessionId={initial.id} />
      ) : (
      <SessionDetailsForm
        form={form} setForm={setForm} services={services} savedLocations={savedLocations}
        initial={initial} isEdit={isEdit} isView={isView} scope={scope} setScope={setScope}
        serviceSearch={serviceSearch} setServiceSearch={setServiceSearch} lookupError={lookupError}
        onRetryLookup={() => setLookupAttempt((value) => value + 1)} conflict={conflict} busy={busy}
        onCancelSession={() => requestReview("cancel")}
      />
      )}
      </TabPanel>

      <ConfirmDialog
        open={review !== null}
        onClose={() => !busy && !savingNote && setReview(null)}
        onConfirm={review?.action === "cancel" ? cancel : review?.action === "note" ? saveNote : save}
        title={review?.action === "cancel" ? uiText("ui.cancel.this.session") : uiText("session.reviewChange")}
        description={review ? `${uiText("session.impact", {sessions: review.impact.sessionCount, bookings: review.impact.activeBookingCount, paid: review.impact.paidBookingCount})} ${review.impact.paidBookingCount && review.action === "cancel" ? uiText("session.manualRefund") : ""} ${uiText("session.current", {date: new Date(review.latest.startISO).toLocaleString(localeForLang(lang), {timeZone: timezone}), location: review.latest.location, capacity: review.latest.capacity})}` : ""}
        confirmLabel={review?.action === "cancel" ? uiText("ui.cancel.session") : uiText("ui.save.changes")}
        destructive={review?.action === "cancel"}
        busy={busy || savingNote}
      />
    </DrawerShell>
  );
}
