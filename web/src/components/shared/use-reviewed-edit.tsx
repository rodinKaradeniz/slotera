"use client";
import * as React from "react";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { ApiRequestError } from "@/services/_errors";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function useReviewedEdit<T extends {id: string; version?: number}>(
  open: boolean, initial: T | null | undefined,
  load: (id: string) => Promise<T | null>, onLoad: (item: T) => void,
) {
  const [version, setVersion] = React.useState(initial?.version);
  const [stale, setStale] = React.useState(false);
  useResetOnOpen(open, [initial?.id], () => {setVersion(initial?.version); setStale(false);});
  const accept = (item: T) => {setVersion(item.version); setStale(false);};
  const onError = (error: unknown) => {
    const conflict = error instanceof ApiRequestError && error.code === "resource_stale";
    if (conflict) setStale(true);
    return conflict;
  };
  const reload = async () => {
    if (!initial) return;
    const latest = await load(initial.id);
    if (!latest) throw new ApiRequestError(404, "not_found", "This item no longer exists.");
    onLoad(latest); accept(latest);
  };
  return {version, accept, onError, stale, notice: <StaleEditNotice active={stale} onReload={reload} />};
}

function StaleEditNotice({active, onReload}: {active: boolean; onReload: () => Promise<void>}) {
  const {t} = useI18n();
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!active) return null;
  return <div role="alert" className="rounded-md border border-warning bg-surface-warm p-4 space-y-3">
    <p>{t("editing.stale")}</p>
    {error && <p className="text-small text-danger">{error}</p>}
    <Button variant="secondary" onClick={() => setConfirm(true)}>{t("editing.reload")}</Button>
    <ConfirmDialog open={confirm} busy={busy} onClose={() => !busy && setConfirm(false)}
      title={t("editing.reload")} description={t("editing.discard")}
      confirmLabel={t("editing.load")} onConfirm={async () => {
        setBusy(true); setError(null);
        try {await onReload(); setConfirm(false);}
        catch (cause) {setError(cause instanceof Error ? cause.message : String(cause));}
        finally {setBusy(false);}
      }} />
  </div>;
}
