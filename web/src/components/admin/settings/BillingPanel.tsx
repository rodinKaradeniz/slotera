"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ContactModal } from "@/components/public/ContactModal";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { CardHead } from "@/components/shared/CardHead";
import { currentSession } from "@/services/auth.service";
import {
  cancelSubscription,
  changePlan,
  getSubscription,
  listInvoices,
  listPlans,
  reactivateSubscription,
  updateMockPaymentMethod,
} from "@/services/billing.service";
import { PLAN_LABEL, SUBSCRIPTION_STATUS } from "@/lib/status-maps";
import { gbp } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/cn";
import {
  detectCardBrand,
  formatCardCvc,
  formatCardExpiry,
  formatCardNumber,
  isValidCardExpiry,
  parseCardExpiry,
} from "@/lib/card";
import type {
  BillingCycle,
  Invoice,
  PlanId,
  SubscriptionPlan,
  WorkspaceSubscription,
} from "@/types/billing";

export function BillingPanel() {
  const { toast } = useToast();
  const [sub, setSub] = React.useState<WorkspaceSubscription | null>(null);
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [planModal, setPlanModal] = React.useState(false);
  const [cancelModal, setCancelModal] = React.useState(false);
  const [cardModal, setCardModal] = React.useState(false);
  const [customContactOpen, setCustomContactOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    Promise.all([getSubscription(), listPlans(), listInvoices()]).then(
      ([s, p, i]) => {
        setSub(s);
        setPlans(p);
        setInvoices(i);
      },
    );
  }, []);

  const refresh = async () => {
    const next = await getSubscription();
    setSub(next);
  };

  const onChangePlan = async (planId: PlanId, cycle: BillingCycle) => {
    setBusy(true);
    try {
      await changePlan(planId, cycle);
      await refresh();
      setPlanModal(false);
      toast.success("Plan updated");
    } catch (err) {
      toast.error("Couldn't change plan", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    setBusy(true);
    try {
      const next = await cancelSubscription();
      await refresh();
      setCancelModal(false);
      toast.info("Subscription cancelled", {
        description: next.cancelAtISO
          ? `Active until ${fmtDate(new Date(next.cancelAtISO))}.`
          : "It'll stay active until the end of the current cycle.",
      });
    } catch (err) {
      toast.error("Couldn't cancel subscription", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const onReactivate = async () => {
    setBusy(true);
    try {
      await reactivateSubscription();
      await refresh();
      toast.success("Subscription reactivated");
    } catch (err) {
      toast.error("Couldn't reactivate subscription", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (!sub) return <LoadingRows count={2} />;

  const meta = SUBSCRIPTION_STATUS[sub.status];

  return (
    <>
      <Card padded>
        <div className="flex flex-col gap-1 mb-1">
          <div className="eyebrow">Current plan</div>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-3">
              <span
                className="font-serif text-ink"
                style={{ fontSize: 32, fontWeight: 380, letterSpacing: "-0.015em" }}
              >
                {PLAN_LABEL[sub.planId]}
              </span>
              <Pill tone={meta.tone} icon={meta.icon}>{meta.label}</Pill>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className="font-serif text-ink"
                style={{ fontSize: 24, fontWeight: 380 }}
              >
                {sub.planId === "custom" ? "Custom" : gbp(sub.amount)}
              </span>
              {sub.planId !== "custom" && (
                <span className="text-small">
                  /{sub.billingCycle === "yearly" ? "yr" : "mo"}
                </span>
              )}
            </div>
          </div>
          <p className="text-small mt-1">
            How you pay Slotera. Your clients&apos; payments are handled under{" "}
            <span className="text-ink-2">Client payments</span>.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-line-soft">
          <Info label="Billing cycle" value={sub.billingCycle === "yearly" ? "Yearly" : "Monthly"} />
          <Info
            label={sub.status === "trialing" ? "Trial ends" : "Next billing date"}
            value={
              sub.status === "trialing" && sub.trialEndsAtISO
                ? fmtDate(new Date(sub.trialEndsAtISO))
                : sub.nextBillingAtISO
                  ? fmtDate(new Date(sub.nextBillingAtISO))
                  : "—"
            }
          />
          <Info
            label="Team members"
            value={`${sub.seats} / ${sub.maxSeats === 999 ? "Unlimited" : sub.maxSeats}`}
          />
        </div>

        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-line-soft">
          <Button variant="primary" icon="card" onClick={() => setPlanModal(true)}>
            Change plan
          </Button>
          {sub.status === "cancel_scheduled" || sub.status === "cancelled" ? (
            <Button
              variant="secondary"
              icon="play"
              loading={busy}
              onClick={onReactivate}
            >
              Reactivate subscription
            </Button>
          ) : (
            <Button
              variant="ghost"
              icon="x"
              onClick={() => setCancelModal(true)}
            >
              Cancel subscription
            </Button>
          )}
        </div>

        {sub.cancelAtISO && sub.status === "cancel_scheduled" && (
          <div className="mt-4 px-3 py-2 rounded-md bg-[#F4E9D6] text-warning text-small">
            Subscription is scheduled to cancel on{" "}
            {fmtDate(new Date(sub.cancelAtISO))}. Reactivate to keep it running.
          </div>
        )}
      </Card>

      <Card padded>
        <h3 className="text-h3 text-ink mb-3" style={{ fontSize: 16 }}>
          Usage this month
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <UsageBar label="Active services" value={sub.usage.activeServices} max={50} />
          <UsageBar label="Bookings" value={sub.usage.monthlyBookings} max={500} />
          <UsageBar label="Clients" value={sub.usage.clients} max={500} />
        </div>
      </Card>

      <Card padded>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3 text-ink" style={{ fontSize: 16 }}>
            Payment method
          </h3>
          <Button
            variant="secondary"
            size="sm"
            icon="edit"
            onClick={() => setCardModal(true)}
          >
            {sub.paymentMethod ? "Update card" : "Add card"}
          </Button>
        </div>
        {sub.paymentMethod ? (
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
              <Icon name="card" size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-ink truncate">
                {sub.paymentMethod.brand} ····{sub.paymentMethod.last4}
              </div>
              <div className="text-small">
                Expires {String(sub.paymentMethod.expMonth).padStart(2, "0")}/
                {sub.paymentMethod.expYear} · {sub.paymentMethod.holder}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-small">No payment method on file.</p>
        )}
      </Card>

      <Card padded={false}>
        <CardHead title="Invoice history" />
        {invoices.length === 0 ? (
          <div className="px-5 py-6 text-small">No invoices yet.</div>
        ) : (
          invoices.map((inv) => (
            <div
              key={inv.id}
              className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0"
            >
              <div>
                <div className="text-[14px] text-ink">{inv.number}</div>
                <div className="text-small">
                  {PLAN_LABEL[inv.planId]} ·{" "}
                  {inv.billingCycle === "yearly" ? "Yearly" : "Monthly"}
                </div>
              </div>
              <div className="text-small whitespace-nowrap">
                {fmtDate(new Date(inv.issuedAtISO), "short")}
              </div>
              <div className="text-[14px] font-medium text-ink">
                {gbp(inv.amount)}
              </div>
              <Pill tone={inv.status === "paid" ? "accent" : "warning"}>
                {inv.status === "paid" ? "Paid" : inv.status}
              </Pill>
            </div>
          ))
        )}
      </Card>

      <PlanModal
        open={planModal}
        onClose={() => setPlanModal(false)}
        plans={plans}
        current={sub}
        onConfirm={onChangePlan}
        onCustomSelected={() => {
          setPlanModal(false);
          setCustomContactOpen(true);
        }}
        busy={busy}
      />

      <Modal
        open={cancelModal}
        onClose={() => setCancelModal(false)}
        title="Cancel subscription?"
        description={
          <>
            Your subscription will remain active until{" "}
            <strong>
              {sub.nextBillingAtISO
                ? fmtDate(new Date(sub.nextBillingAtISO))
                : "the end of the current cycle"}
            </strong>
            . You can reactivate before that date to keep things running.
          </>
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelModal(false)}>
              Keep subscription
            </Button>
            <Button variant="danger" loading={busy} onClick={onCancel}>
              Cancel subscription
            </Button>
          </>
        }
      />

      <UpdatePaymentMethodModal
        open={cardModal}
        onClose={() => setCardModal(false)}
        currentHolder={sub.paymentMethod?.holder ?? ""}
        onUpdated={async () => {
          await refresh();
          setCardModal(false);
          toast.success("Payment method updated");
        }}
        onError={(msg) =>
          toast.error("Couldn't update payment method", { description: msg })
        }
      />

      <ContactModal
        open={customContactOpen}
        onClose={() => setCustomContactOpen(false)}
        persist
        eyebrow="Custom plan"
        title="Talk to Slotera"
        description="Tell us about your team size or use case and we'll set up a tailored plan. Your current subscription stays as-is until we agree on terms."
        presetName={currentSession()?.operator.name ?? ""}
        presetEmail={currentSession()?.operator.email ?? ""}
        defaultReason="business"
        presetMessage="I'd like to upgrade to a Custom plan — please get in touch."
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow">{label}</span>
      <span className="text-[14px] text-ink">{value}</span>
    </div>
  );
}

function UsageBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-small">{label}</span>
        <span className="text-[13px] font-medium text-ink">
          {value}
          <span className="text-ink-3"> / {max}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-paper-2 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PlanModal({
  open,
  onClose,
  plans,
  current,
  onConfirm,
  onCustomSelected,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  plans: SubscriptionPlan[];
  current: WorkspaceSubscription;
  onConfirm: (planId: PlanId, cycle: BillingCycle) => void;
  /** Called when the operator chooses Custom — should open the sales-contact flow. */
  onCustomSelected: () => void;
  busy: boolean;
}) {
  const [planId, setPlanId] = React.useState<PlanId>(current.planId);
  const [cycle, setCycle] = React.useState<BillingCycle>(current.billingCycle);
  const isCustom = planId === "custom";

  React.useEffect(() => {
    if (open) {
      setPlanId(current.planId);
      setCycle(current.billingCycle);
    }
  }, [open, current.planId, current.billingCycle]);

  return (
    <Modal open={open} onClose={onClose} title="Change plan" size="lg">
      <div className="flex items-center justify-end mb-4">
        <div className="inline-flex rounded-md border border-line p-1 text-[13px]">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={cn(
              "px-3 py-1 rounded",
              cycle === "monthly" ? "bg-ink text-paper" : "text-ink-2",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle("yearly")}
            className={cn(
              "px-3 py-1 rounded",
              cycle === "yearly" ? "bg-ink text-paper" : "text-ink-2",
            )}
          >
            Yearly · −20%
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {plans.map((p) => {
          const selected = planId === p.id;
          const price = cycle === "yearly" ? p.priceYearly : p.priceMonthly;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setPlanId(p.id)}
              className={cn(
                "text-left rounded-lg border p-4 transition-colors",
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-ink-3",
              )}
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-h3 text-ink" style={{ fontSize: 16 }}>
                  {p.name}
                </span>
                {selected && <Icon name="check" size={14} className="text-accent" />}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span
                  className="font-serif text-ink"
                  style={{ fontSize: 22, fontWeight: 380 }}
                >
                  {p.id === "custom" ? "Custom" : gbp(price)}
                </span>
                {p.id !== "custom" && (
                  <span className="text-small">
                    /{cycle === "yearly" ? "yr" : "mo"}
                  </span>
                )}
              </div>
              <p className="text-small mb-3">{p.description}</p>
              <ul className="flex flex-col gap-1.5">
                {p.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[13px] text-ink-2">
                    <Icon name="check" size={12} className="text-accent mt-1" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {isCustom && (
        <div className="mt-5 rounded-md border border-line-soft bg-paper-2 px-4 py-3 text-small">
          Custom plans are tailored per team. Send us a quick note and Slotera
          will follow up to set this up — no automatic upgrade yet.
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {isCustom ? (
          <Button
            variant="primary"
            icon="mail"
            onClick={onCustomSelected}
          >
            Contact Slotera
          </Button>
        ) : (
          <Button
            variant="primary"
            loading={busy}
            onClick={() => onConfirm(planId, cycle)}
            disabled={
              planId === current.planId && cycle === current.billingCycle
            }
          >
            Confirm change
          </Button>
        )}
      </div>
    </Modal>
  );
}

type CardForm = {
  holder: string;
  number: string;
  exp: string;
  cvc: string;
};

const EMPTY_CARD: CardForm = { holder: "", number: "", exp: "", cvc: "" };

function UpdatePaymentMethodModal({
  open,
  onClose,
  currentHolder,
  onUpdated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  currentHolder: string;
  onUpdated: () => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = React.useState<CardForm>(EMPTY_CARD);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm({ ...EMPTY_CARD, holder: currentHolder });
  }, [open, currentHolder]);

  const valid =
    form.holder.trim().length > 1 &&
    form.number.replace(/\s/g, "").length >= 12 &&
    isValidCardExpiry(form.exp) &&
    /^\d{3,4}$/.test(form.cvc.trim());

  const submit = async () => {
    if (!valid) return;
    const raw = form.number.replace(/\s/g, "");
    if (raw.endsWith("0002")) {
      onError("Card declined. Try 4242 4242 4242 4242 for a mock success.");
      return;
    }
    setBusy(true);
    try {
      const { month, year } = parseCardExpiry(form.exp);
      await updateMockPaymentMethod({
        brand: detectCardBrand(raw),
        last4: raw.slice(-4),
        expMonth: month,
        expYear: year,
        holder: form.holder.trim(),
      });
      await onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update payment method"
      description="Mocked checkout — no real charge."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!valid}
            onClick={submit}
          >
            Save card
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Cardholder name" required>
          <Input
            value={form.holder}
            onChange={(e) => setForm({ ...form, holder: e.target.value })}
            autoComplete="cc-name"
          />
        </Field>
        <Field
          label="Card number"
          required
          hint="4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 declines."
        >
          <Input
            value={form.number}
            onChange={(e) =>
              setForm({ ...form, number: formatCardNumber(e.target.value) })
            }
            placeholder="4242 4242 4242 4242"
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={19}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expiration" required>
            <Input
              value={form.exp}
              onChange={(e) =>
                setForm({ ...form, exp: formatCardExpiry(e.target.value) })
              }
              placeholder="MM / YY"
              inputMode="numeric"
              autoComplete="cc-exp"
              maxLength={7}
            />
          </Field>
          <Field label="CVC" required>
            <Input
              value={form.cvc}
              onChange={(e) =>
                setForm({ ...form, cvc: formatCardCvc(e.target.value) })
              }
              placeholder="123"
              inputMode="numeric"
              autoComplete="cc-csc"
              maxLength={4}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
