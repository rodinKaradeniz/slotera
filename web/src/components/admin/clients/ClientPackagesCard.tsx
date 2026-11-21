"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { CardHead } from "@/components/shared/CardHead";
import { LoadError } from "@/components/shared/LoadError";
import { useLoad } from "@/lib/use-load";
import { useLeavingRows } from "@/lib/use-leaving-rows";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import { listActivePackages } from "@/services/packages.service";
import {
  listClientPackagePurchases,
  markPackagePaid,
  recordPackageSale,
  voidPackagePurchase,
} from "@/services/package-purchases.service";
import type { PackagePurchase } from "@/types/package-purchase";
import type { ServicePackage } from "@/types/package";

/**
 * Packages the operator sold to this client (paid outside Slotera): how many sessions are
 * booked, which bookings hold them, and the sale's payment. Sessions are booked from New
 * booking; this card records the sale, the payment and a void.
 */
export function ClientPackagesCard({ clientId, readOnly }: { clientId: string; readOnly?: boolean }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const load = React.useCallback(() => listClientPackagePurchases(clientId), [clientId]);
  const { data, error, reload } = useLoad(load);
  const rows = useLeavingRows(data ?? [], (item) => item.id);
  const [recording, setRecording] = React.useState(false);
  const [voiding, setVoiding] = React.useState<PackagePurchase | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const act = async (id: string, run: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await run();
      toast.success(done);
      reload();
    } catch (cause) {
      toast.error(t("packageSales.failed"), { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card padded={false} className="min-w-0">
      <CardHead
        title={t("packageSales.title")}
        right={!readOnly && (
          <Button variant="ghost" size="sm" icon="plus" onClick={() => setRecording(true)}>
            {t("packageSales.record")}
          </Button>
        )}
      />
      {error ? (
        <div className="p-5"><LoadError message={error} onRetry={reload} /></div>
      ) : !data ? (
        <p role="status" className="px-5 py-4 text-small">{t("ui.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-5 text-small text-ink-2">{t("packageSales.empty")}</p>
      ) : (
        <ul>
          {rows.map(({ item, leaving }) => (
            <li key={item.id} className="row-shell border-b border-line-soft last:border-b-0" data-state={leaving ? "closed" : "open"} inert={leaving}>
              <PurchaseRow
                purchase={item}
                busy={busy === item.id}
                readOnly={readOnly}
                onMarkPaid={() => act(item.id, () => markPackagePaid(item.id, item.version), t("packageSales.paidToast"))}
                onVoid={() => setVoiding(item)}
              />
            </li>
          ))}
        </ul>
      )}
      <RecordSaleDialog
        open={recording}
        clientId={clientId}
        onClose={() => setRecording(false)}
        onRecorded={() => { setRecording(false); toast.success(t("packageSales.recorded")); reload(); }}
      />
      <ConfirmDialog
        open={!!voiding}
        busy={!!voiding && busy === voiding.id}
        onClose={() => busy === null && setVoiding(null)}
        onConfirm={async () => {
          if (!voiding) return;
          await act(voiding.id, () => voidPackagePurchase(voiding.id, voiding.version), t("packageSales.voidedToast"));
          setVoiding(null);
        }}
        title={t("packageSales.voidTitle", { name: voiding?.packageName ?? "" })}
        description={t("packageSales.voidBody")}
        confirmLabel={t("packageSales.void")}
        destructive
      />
    </Card>
  );
}

function PurchaseRow({ purchase, busy, readOnly, onMarkPaid, onVoid }: {
  purchase: PackagePurchase; busy: boolean; readOnly?: boolean; onMarkPaid: () => void; onVoid: () => void;
}) {
  const { t } = useI18n();
  const voided = purchase.status === "voided";
  return (
    <div className={voided ? "px-5 py-4 opacity-70" : "px-5 py-4"}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[15px] text-ink font-medium">{purchase.packageName}</span>
        <span className="text-small tabular-nums">{formatMoney(purchase.priceCents, purchase.currency)}</span>
        <span className="flex-1" />
        {voided ? (
          <Pill>{t("packageSales.voided")}</Pill>
        ) : purchase.paymentStatus === "paid" ? (
          <Pill tone="success">{t("packageSales.paid")}</Pill>
        ) : (
          <Pill tone="warning">{t("packageSales.awaitingPayment")}</Pill>
        )}
      </div>
      <p className="text-small mt-1 tabular-nums">
        {t("packageSales.used", { used: purchase.usedCount, total: purchase.items.length })}
        {!voided && <> · {t("packageSales.left", { count: purchase.remainingCount })}</>}
      </p>
      <ol className="mt-3 grid gap-1.5">
        {purchase.items.map((item) => (
          <li key={item.position} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-2 text-small">
            <span className="text-ink-3 tabular-nums">{item.position + 1}.</span>
            <span className="truncate text-ink-2">{item.title}</span>
            {item.booking ? (
              <Link href={`/admin/bookings/${encodeURIComponent(item.booking.id)}`} className="text-accent hover:underline tabular-nums">
                {fmtDate(new Date(item.booking.startISO), "short")}
              </Link>
            ) : (
              <span className="text-ink-3">{t("packageSales.notBooked")}</span>
            )}
          </li>
        ))}
      </ol>
      {purchase.notes && <p className="text-micro text-ink-3 mt-3 whitespace-pre-line">{purchase.notes}</p>}
      {!readOnly && !voided && (
        <div className="flex flex-wrap gap-2 mt-3">
          {purchase.paymentStatus === "pending" && (
            <Button size="sm" variant="secondary" loading={busy} onClick={onMarkPaid}>{t("packageSales.markPaid")}</Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={onVoid}>{t("packageSales.void")}</Button>
        </div>
      )}
    </div>
  );
}

function RecordSaleDialog({ open, clientId, onClose, onRecorded }: {
  open: boolean; clientId: string; onClose: () => void; onRecorded: (purchase: PackagePurchase) => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [packages, setPackages] = React.useState<ServicePackage[] | null>(null);
  const [packageId, setPackageId] = React.useState("");
  const [paid, setPaid] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // One key per opened dialog: a double click or a retry records the sale once.
  const [key, setKey] = React.useState(() => crypto.randomUUID());
  useResetOnOpen(open, [clientId], () => {
    setPackageId(""); setPaid(false); setNotes(""); setPackages(null); setKey(crypto.randomUUID());
  });
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    listActivePackages().then((items) => { if (live) setPackages(items); }, () => { if (live) setPackages([]); });
    return () => { live = false; };
  }, [open]);

  const submit = async () => {
    if (!packageId) return;
    setBusy(true);
    try {
      onRecorded(await recordPackageSale(clientId, { packageId, paymentReceived: paid, notes }, key));
    } catch (cause) {
      toast.error(t("packageSales.failed"), { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const chosen = packages?.find((item) => item.id === packageId);
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("packageSales.recordTitle")}
      description={t("packageSales.recordBody")}
      size="md"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t("ui.cancel")}</Button>
        <Button onClick={submit} loading={busy} disabled={!packageId || busy}>{t("packageSales.record")}</Button>
      </>}
    >
      <div className="flex flex-col gap-4">
        {packages && packages.length === 0 ? (
          <p className="text-small text-ink-2">{t("packageSales.noActive")}</p>
        ) : (
          <Field label={t("packageSales.package")} required>
            <Select
              value={packageId}
              onChange={(event) => setPackageId(event.target.value)}
              options={[
                { value: "", label: packages === null ? t("ui.loading") : t("packageSales.choose") },
                ...(packages ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.name} · ${formatMoney(item.priceCents, item.currency)}`,
                })),
              ]}
            />
          </Field>
        )}
        {chosen && (
          <p className="text-small">{t("packageSales.left", { count: chosen.items.length })}</p>
        )}
        <label className="flex items-center gap-3 text-small text-ink-2 cursor-pointer">
          <Checkbox checked={paid} onChange={setPaid} aria-label={t("packageSales.paymentReceived")} />
          {t("packageSales.paymentReceived")}
        </label>
        <Field label={t("packageSales.note")} optional>
          <Textarea rows={2} value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
