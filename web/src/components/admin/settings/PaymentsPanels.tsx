"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ManualPaymentForm } from "@/components/shared/forms/ManualPaymentForm";
import { useToast } from "@/components/ui/Toast";
import { updateSettings, updatePaymentSettings, type PaymentSettings } from "@/services/settings.service";
import { PanelProps, PanelCard } from "./PanelCard";
import { BookingTermsPanel } from "./CalendarPanels";

export function PaymentsPanel({ data, onChange }: PanelProps) {
  const { t: uiText } = useI18n();
  return (
    <>
      <Card padded>
        <div className="mb-4">
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>{uiText("ui.payment.processors")}</h2>
          <p className="text-small mt-1">
            {uiText("ui.how.your.clients.pay.you.to.manage.how.you.pay.slotera.see")}{" "}
            <span className="text-ink-2">{uiText("ui.billing.subscription")}</span>.
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-line-soft bg-paper-2 px-3 py-2 mb-4 text-small text-ink-2">
          <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink-3" />
          <span>
            {uiText("ui.stripe.powered.card.payments.may.include.processing.fees.fees.vary.by.payment.method.and.r")}</span>
        </div>
        <div className="flex flex-col">
          {data.payments.processors.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0"
            >
              <span className="w-9 h-9 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
                <Icon name="card" size={16} />
              </span>
              <div className="flex-1">
                <div className="text-[14px] font-medium text-ink">{p.label}</div>
                <div className="text-small">{p.detail}</div>
              </div>
              <Pill tone={p.status === "connected" ? "accent" : "neutral"}>
                {p.status === "connected" ? uiText("ui.connected") : uiText("ui.not.connected")}
              </Pill>
              <Button variant="secondary" size="sm">
                {p.status === "connected" ? uiText("ui.manage") : uiText("ui.connect")}
              </Button>
            </div>
          ))}
        </div>
      </Card>
      <ManualPaymentPanel data={data} onChange={onChange} />
      <BookingTermsPanel data={data} onChange={onChange} />
      <Card padded>
        <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>{uiText("ui.tax")}</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={uiText("ui.tax.rate")}>
            <Input value={String(data.payments.taxRate)} readOnly />
          </Field>
          <Field label={uiText("ui.vat.number")}>
            <Input value={data.payments.vatNumber} readOnly />
          </Field>
        </div>
      </Card>
    </>
  );
}

export function ApiPaymentsPanel({
  payments,
  onChange,
}: {
  payments: PaymentSettings;
  onChange: (next: PaymentSettings) => void;
}) {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [local, setLocal] = React.useState(payments);
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const next = await updatePaymentSettings(local);
      setLocal(next);
      onChange(next);
      toast.success(uiText("ui.client.payment.settings.saved"));
    } catch (error) {
      toast.error(uiText("ui.couldn.t.save.client.payment.settings"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <Card padded>
        <h3 className="text-h3 text-ink mb-1" style={{ fontSize: 18 }}>
          {uiText("ui.offline.client.payments")}</h3>
        <p className="text-small mb-5">
          {uiText("ui.slotera.records.the.booking.as.payment.pending.the.client.pays.using.instructions.you.prov")}</p>
        <ManualPaymentForm
          value={{
            enabled: local.manualPaymentEnabled,
            instructions: local.manualPaymentInstructions,
          }}
          onChange={(value) =>
            setLocal({
              ...local,
              manualPaymentEnabled: value.enabled,
              manualPaymentInstructions: value.instructions,
            })
          }
        />
      </Card>
      <Card padded>
        <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 18 }}>
          {uiText("ui.booking.terms")}</h3>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[14px] font-medium text-ink">
            {uiText("ui.show.provider.terms.at.checkout")}</span>
          <Toggle
            checked={local.bookingTermsEnabled}
            onChange={(bookingTermsEnabled) =>
              setLocal({ ...local, bookingTermsEnabled })
            }
          />
        </div>
        <Textarea
          rows={7}
          disabled={!local.bookingTermsEnabled}
          value={local.bookingTermsContent}
          onChange={(event) =>
            setLocal({ ...local, bookingTermsContent: event.target.value })
          }
        />
      </Card>
      <Card padded>
        <h3 className="text-h3 text-ink mb-1" style={{ fontSize: 18 }}>
          {uiText("ui.tax.inclusive.pricing")}</h3>
        <p className="text-small mb-5">
          {uiText("ui.published.service.prices.are.gross.totals.a.fixed.rate.splits.that.total.into.net.and.tax.")}</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={uiText("ui.tax.treatment")}>
            <Select
              value={local.taxTreatment}
              onChange={(event) =>
                setLocal({
                  ...local,
                  taxTreatment: event.target.value as "none" | "fixed",
                  taxRateBps: event.target.value === "none" ? 0 : local.taxRateBps,
                })
              }
              options={[
                { value: "none", label: uiText("ui.no.tax.split") },
                { value: "fixed", label: uiText("ui.fixed.tax.rate") },
              ]}
            />
          </Field>
          <Field label={uiText("ui.tax.rate")}>
            <Input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              disabled={local.taxTreatment === "none"}
              value={local.taxTreatment === "none" ? "" : local.taxRateBps / 100}
              onChange={(event) =>
                setLocal({
                  ...local,
                  taxRateBps: Math.round(Number(event.target.value) * 100),
                })
              }
            />
          </Field>
          <Field label={uiText("ui.tax.label")}>
            <Input
              value={local.taxLabel}
              onChange={(event) => setLocal({ ...local, taxLabel: event.target.value })}
            />
          </Field>
          <Field label={uiText("ui.jurisdiction.country.code")}>
            <Input
              maxLength={2}
              value={local.taxJurisdiction}
              onChange={(event) =>
                setLocal({ ...local, taxJurisdiction: event.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field label={uiText("ui.seller.tax.number")} className="sm:col-span-2">
            <Input
              value={local.sellerTaxNumber}
              onChange={(event) =>
                setLocal({ ...local, sellerTaxNumber: event.target.value })
              }
            />
          </Field>
        </div>
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>{uiText("ui.save.client.payments")}</Button>
      </div>
    </div>
  );
}

export function ManualPaymentPanel({ data, onChange }: PanelProps) {
  const { t: uiText } = useI18n();
  const [value, setValue] = React.useState({
    enabled: data.payments.manualPaymentEnabled,
    instructions: data.payments.manualPaymentInstructions,
  });

  const save = async () => {
    const next = await updateSettings({
      payments: {
        ...data.payments,
        manualPaymentEnabled: value.enabled,
        manualPaymentInstructions: value.instructions,
      },
    });
    onChange(next);
  };

  const remove = async () => {
    setValue({ enabled: false, instructions: "" });
    const next = await updateSettings({
      payments: {
        ...data.payments,
        manualPaymentEnabled: false,
        manualPaymentInstructions: "",
      },
    });
    onChange(next);
  };

  return (
    <PanelCard
      title={uiText("ui.manual.payment")}
      hint={uiText("ui.show.clients.custom.payment.instructions.bank.transfer.interac.etc.at.checkout.bookings.us")}
      onSave={save}
    >
      <ManualPaymentForm value={value} onChange={setValue} />

      {data.payments.manualPaymentInstructions && (
        <div className="flex justify-end mt-4">
          <Button variant="ghost" size="sm" icon="trash" onClick={remove}>
            {uiText("ui.clear.instructions")}</Button>
        </div>
      )}
    </PanelCard>
  );
}
