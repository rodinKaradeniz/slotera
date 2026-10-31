"use client";

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
  return (
    <>
      <Card padded>
        <div className="mb-4">
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>Payment Processors</h2>
          <p className="text-small mt-1">
            How your clients pay you. To manage how you pay Slotera, see{" "}
            <span className="text-ink-2">Billing &amp; Subscription</span>.
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-line-soft bg-paper-2 px-3 py-2 mb-4 text-small text-ink-2">
          <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink-3" />
          <span>
            Stripe-powered card payments may include processing fees. Fees vary
            by payment method and region. Review Stripe pricing before enabling
            live payments.
          </span>
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
                {p.status === "connected" ? "Connected" : "Not connected"}
              </Pill>
              <Button variant="secondary" size="sm">
                {p.status === "connected" ? "Manage" : "Connect"}
              </Button>
            </div>
          ))}
        </div>
      </Card>
      <ManualPaymentPanel data={data} onChange={onChange} />
      <BookingTermsPanel data={data} onChange={onChange} />
      <Card padded>
        <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>Tax</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Tax rate (%)">
            <Input value={String(data.payments.taxRate)} readOnly />
          </Field>
          <Field label="VAT number">
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
  const { toast } = useToast();
  const [local, setLocal] = React.useState(payments);
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const next = await updatePaymentSettings(local);
      setLocal(next);
      onChange(next);
      toast.success("Client payment settings saved");
    } catch (error) {
      toast.error("Couldn't save client payment settings", {
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
          Offline client payments
        </h3>
        <p className="text-small mb-5">
          Slotera records the booking as payment pending. The client pays using
          instructions you provide outside Slotera.
        </p>
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
          Booking terms
        </h3>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[14px] font-medium text-ink">
            Show provider terms at checkout
          </span>
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
          Tax-inclusive pricing
        </h3>
        <p className="text-small mb-5">
          Published service prices are gross totals. A fixed rate splits that
          total into net and tax snapshots when a booking is created.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Tax treatment">
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
                { value: "none", label: "No tax split" },
                { value: "fixed", label: "Fixed tax rate" },
              ]}
            />
          </Field>
          <Field label="Tax rate (%)">
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
          <Field label="Tax label">
            <Input
              value={local.taxLabel}
              onChange={(event) => setLocal({ ...local, taxLabel: event.target.value })}
            />
          </Field>
          <Field label="Jurisdiction (country code)">
            <Input
              maxLength={2}
              value={local.taxJurisdiction}
              onChange={(event) =>
                setLocal({ ...local, taxJurisdiction: event.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field label="Seller tax number" className="sm:col-span-2">
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
        <Button onClick={save} loading={saving}>Save client payments</Button>
      </div>
    </div>
  );
}

export function ManualPaymentPanel({ data, onChange }: PanelProps) {
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
      title="Manual Payment"
      hint="Show clients custom payment instructions (bank transfer, Interac, etc.) at checkout. Bookings using manual payment stay pending until you confirm receipt."
      onSave={save}
    >
      <ManualPaymentForm value={value} onChange={setValue} />

      {data.payments.manualPaymentInstructions && (
        <div className="flex justify-end mt-4">
          <Button variant="ghost" size="sm" icon="trash" onClick={remove}>
            Clear instructions
          </Button>
        </div>
      )}
    </PanelCard>
  );
}
