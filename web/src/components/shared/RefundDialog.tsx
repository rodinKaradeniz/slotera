"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { currencySymbol, formatMoney } from "@/lib/money";
import type { Currency } from "@/types/common";

/**
 * Records money the consultant gave back outside Slotera, so revenue and the client's total
 * stay right. The amount starts at everything still refundable; a smaller amount is a
 * partial refund, and refunds add up.
 */
export function RefundDialog({ open, refundableCents, currency, onClose, onRefund }: {
  open: boolean;
  refundableCents: number;
  currency: Currency;
  onClose: () => void;
  onRefund: (amountCents: number) => Promise<void>;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  useResetOnOpen(open, [refundableCents], () => setAmount((refundableCents / 100).toFixed(2)));
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  const valid = Number.isFinite(cents) && cents > 0 && cents <= refundableCents;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await onRefund(cents);
      toast.success(t("refund.recorded"));
      onClose();
    } catch (cause) {
      toast.error(t("refund.failed"), { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("refund.title")}
      description={t("refund.body")}
      size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t("ui.cancel")}</Button>
        <Button onClick={submit} loading={busy} disabled={!valid || busy}>{t("refund.record")}</Button>
      </>}
    >
      <Field
        label={t("refund.amount", { currency: currencySymbol(currency) })}
        hint={t("refund.max", { amount: formatMoney(refundableCents, currency) })}
        required
      >
        <Input type="number" inputMode="decimal" min={0.01} step={0.01} value={amount}
          onChange={(event) => setAmount(event.target.value)} aria-invalid={!valid} />
      </Field>
    </Modal>
  );
}
