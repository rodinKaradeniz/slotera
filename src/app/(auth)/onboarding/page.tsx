"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  ServiceForm,
  type ServiceFormValue,
} from "@/components/shared/forms/ServiceForm";
import { WorkingHoursForm } from "@/components/shared/forms/WorkingHoursForm";
import {
  ManualPaymentForm,
  type ManualPaymentValue,
} from "@/components/shared/forms/ManualPaymentForm";
import { currentSession, markOnboardingStep } from "@/services/auth.service";
import { createService } from "@/services/services.service";
import { getSettings, updateSettings } from "@/services/settings.service";
import type { SettingsData, WorkingDay } from "@/types/settings";
import { cn } from "@/lib/cn";

/* ──────────────────────────────────────────────────────────────────────────
   Onboarding is a five-pane linear stepper:
     0 — Intro
     1 — Create your first service
     2 — Set availability
     3 — Set up payments
     4 — Done

   On mount, completion is data-derived from existing services + settings,
   and the stepper jumps to the first incomplete pane. "Skip for now" exits
   to the dashboard at any point — re-entry resumes from data state again.
   ────────────────────────────────────────────────────────────────────────── */

type StepKey = "intro" | "service" | "availability" | "payments" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "intro", label: "Welcome" },
  { key: "service", label: "Service" },
  { key: "availability", label: "Availability" },
  { key: "payments", label: "Payments" },
  { key: "done", label: "Done" },
];

const DEFAULT_SERVICE: ServiceFormValue = {
  name: "",
  description: "",
  durationMin: 60,
  priceCents: 12000,
  currency: "GBP",
  capacity: 1,
  locationType: "online",
  location: "Zoom · link sent on confirmation",
  bookingMode: "open",
  cancellationRule: "Free reschedule up to 12h before.",
  active: true,
};

const DEFAULT_HOURS: WorkingDay[] = [
  { day: "Mon", enabled: true, start: "09:00", end: "18:00" },
  { day: "Tue", enabled: true, start: "09:00", end: "18:00" },
  { day: "Wed", enabled: true, start: "09:00", end: "18:00" },
  { day: "Thu", enabled: true, start: "09:00", end: "18:00" },
  { day: "Fri", enabled: true, start: "09:00", end: "17:00" },
  { day: "Sat", enabled: false, start: "10:00", end: "14:00" },
  { day: "Sun", enabled: false, start: "10:00", end: "14:00" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<number>(0);
  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const [ready, setReady] = React.useState(false);

  const [operatorName, setOperatorName] = React.useState<string>("Operator");
  const [serviceForm, setServiceForm] =
    React.useState<ServiceFormValue>(DEFAULT_SERVICE);
  const [hours, setHours] = React.useState<WorkingDay[]>(DEFAULT_HOURS);
  const [manualPayment, setManualPayment] = React.useState<ManualPaymentValue>({
    enabled: false,
    instructions: "",
  });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const session = currentSession();
    const first = session?.operator.firstNames?.trim().split(/\s+/)[0];
    if (first) setOperatorName(first);
    else if (session?.operator.name)
      setOperatorName(session.operator.name.split(/\s+/)[0]);

    let cancelled = false;
    (async () => {
      const s = await getSettings();
      if (cancelled) return;
      setSettings(s);
      setHours(s.calendar.workingHours);
      setManualPayment({
        enabled: s.payments.manualPaymentEnabled,
        instructions: s.payments.manualPaymentInstructions,
      });

      // Visual-testing mode: always start on the intro pane so the full
      // five-pane walkthrough is reachable even when the seed mocks already
      // satisfy every completion check. To restore partial-progress resume:
      //   const services = await listServices();
      //   const hasService = services.length > 0;
      //   const hasAvailability = s.calendar.workingHours.some((d) => d.enabled);
      //   const hasPayments = ...;
      //   setStep(resumeStep(hasService, hasAvailability, hasPayments));
      setStep(0);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const skipToDashboard = () => router.push("/admin/dashboard");

  const saveService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error("Give your service a name first.");
      return;
    }
    setBusy(true);
    try {
      await createService(serviceForm);
      markOnboardingStep("service", true);
      toast.success("Service created");
      setStep(2);
    } catch (err) {
      toast.error("Couldn't create service", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const saveAvailability = async () => {
    if (!settings) return;
    if (!hours.some((d) => d.enabled)) {
      toast.error("Enable at least one day so clients can book.");
      return;
    }
    setBusy(true);
    try {
      const next = await updateSettings({
        calendar: { ...settings.calendar, workingHours: hours },
      });
      setSettings(next);
      markOnboardingStep("availability", true);
      toast.success("Availability saved");
      setStep(3);
    } catch (err) {
      toast.error("Couldn't save availability", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const savePayments = async () => {
    if (!settings) return;
    setBusy(true);
    try {
      const next = await updateSettings({
        payments: {
          ...settings.payments,
          manualPaymentEnabled: manualPayment.enabled,
          manualPaymentInstructions: manualPayment.instructions,
        },
      });
      setSettings(next);
      markOnboardingStep("payments", true);
      toast.success("Payment setup saved");
      setStep(4);
    } catch (err) {
      toast.error("Couldn't save payment setup", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <Logo />
        <button
          type="button"
          onClick={skipToDashboard}
          className="text-small text-ink-3 hover:text-ink"
        >
          Skip for now
        </button>
      </div>

      <Card padded className="overflow-hidden">
        <div className="flex flex-col gap-6">
          {!ready ? (
            <div className="flex flex-col gap-4">
              <Skeleton h={28} />
              <Skeleton h={18} w="60%" />
              <Skeleton h={220} />
            </div>
          ) : (
            <>
              <StepHeader step={step} operatorName={operatorName} />
              <StepIndicator step={step} />

              <div className="min-h-[300px]">
                {step === 0 && <IntroPane operatorName={operatorName} />}
                {step === 1 && (
                  <ServiceForm
                    value={serviceForm}
                    onChange={setServiceForm}
                    showActiveToggle={false}
                    disabled={busy}
                  />
                )}
                {step === 2 && (
                  <WorkingHoursForm
                    value={hours}
                    onChange={setHours}
                    disabled={busy}
                  />
                )}
                {step === 3 && (
                  <PaymentsPane
                    value={manualPayment}
                    onChange={setManualPayment}
                    stripeConnected={
                      settings?.payments.processors.some(
                        (p) => p.id === "stripe" && p.status === "connected",
                      ) ?? false
                    }
                    onConnectStripe={async () => {
                      if (!settings) return;
                      const next = await updateSettings({
                        payments: {
                          ...settings.payments,
                          processors: settings.payments.processors.map((p) =>
                            p.id === "stripe"
                              ? { ...p, status: "connected" }
                              : p,
                          ),
                        },
                      });
                      setSettings(next);
                      toast.success("Stripe connected (mock)");
                    }}
                    disabled={busy}
                  />
                )}
                {step === 4 && <DonePane />}
              </div>

              <StepFooter
                step={step}
                busy={busy}
                onBack={() => setStep((s) => Math.max(0, s - 1))}
                onNextFromIntro={() => setStep(1)}
                onSaveService={saveService}
                onSaveAvailability={saveAvailability}
                onSavePayments={savePayments}
                onFinish={skipToDashboard}
              />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ── header / chrome ─────────────────────────────────────────────────────── */

function StepHeader({
  step,
  operatorName,
}: {
  step: number;
  operatorName: string;
}) {
  const meta = STEP_COPY[step];
  return (
    <div className="flex flex-col gap-1">
      <div className="eyebrow">Welcome, {operatorName}</div>
      <h1 className="text-h2 text-ink">{meta.title}</h1>
      <p className="text-body text-ink-3 mt-1">{meta.subtitle}</p>
    </div>
  );
}

const STEP_COPY: { title: string; subtitle: string }[] = [
  {
    title: "Let's get you onboarded",
    subtitle:
      "Three quick steps and you'll have a workspace ready to take bookings.",
  },
  {
    title: "Create your first service",
    subtitle:
      "What do clients book from you? You can add more later — this is just the starting point.",
  },
  {
    title: "Set your availability",
    subtitle:
      "Tell Slotera which days and hours you're open. Group sessions and special dates can be scheduled separately.",
  },
  {
    title: "Set up payments",
    subtitle:
      "Stripe takes cards. Manual payment shows clients custom instructions (bank transfer, Interac).",
  },
  {
    title: "You're all set",
    subtitle: "Your workspace is ready. Share your booking page when you'd like.",
  },
];

function StepIndicator({ step }: { step: number }) {
  // The intro and done panels live outside the 3-step "work" progress.
  if (step === 0 || step === 4) return null;
  const workSteps = STEPS.slice(1, 4); // service, availability, payments
  const activeIdx = step - 1; // 0..2
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {workSteps.map((s, i) => {
          const completed = i < activeIdx;
          const active = i === activeIdx;
          return (
            <React.Fragment key={s.key}>
              <span
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono transition-colors",
                  completed
                    ? "bg-accent text-white"
                    : active
                      ? "bg-ink text-paper"
                      : "bg-paper-2 text-ink-3 border border-line",
                )}
              >
                {completed ? <Icon name="check" size={12} strokeWidth={2.5} /> : i + 1}
              </span>
              {i < workSteps.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1",
                    completed ? "bg-accent" : "bg-line",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-micro">
        {workSteps.map((s) => (
          <span key={s.key}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ── individual panes ────────────────────────────────────────────────────── */

function IntroPane({ operatorName }: { operatorName: string }) {
  const items: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "layers",
      title: "Create your first service",
      body: "Set its duration, price, capacity, and where it happens.",
    },
    {
      icon: "calendar",
      title: "Set your availability",
      body: "Pick which days and hours clients can book.",
    },
    {
      icon: "card",
      title: "Set up payments",
      body: "Stripe for cards, or manual instructions for bank transfer.",
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-ink-2 max-w-xl">
        Hi {operatorName} — here&apos;s what we&apos;ll do together. You can
        skip at any time and come back later from the dashboard.
      </p>
      <ol className="flex flex-col gap-3">
        {items.map((it, i) => (
          <li
            key={it.title}
            className="flex items-start gap-3 rounded-md border border-line-soft bg-surface-warm px-4 py-3"
          >
            <span className="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Icon name={it.icon} size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-ink">
                <span className="text-ink-3 mr-1.5">{i + 1}.</span>
                {it.title}
              </div>
              <p className="text-small mt-0.5">{it.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PaymentsPane({
  value,
  onChange,
  stripeConnected,
  onConnectStripe,
  disabled,
}: {
  value: ManualPaymentValue;
  onChange: (next: ManualPaymentValue) => void;
  stripeConnected: boolean;
  onConnectStripe: () => Promise<void>;
  disabled?: boolean;
}) {
  const [connecting, setConnecting] = React.useState(false);
  const connect = async () => {
    setConnecting(true);
    try {
      await onConnectStripe();
    } finally {
      setConnecting(false);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] items-start">
      <div className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
            <Icon name="card" size={16} />
          </span>
          <span className="text-[15px] font-medium text-ink">
            Stripe (mock)
          </span>
        </div>
        <p className="text-small">
          Take card payments via Stripe. Mocked for the demo — no real account
          needed.
        </p>
        <div className="flex items-start gap-2 rounded-md border border-line-soft bg-paper-2 px-3 py-2 text-small text-ink-2">
          <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink-3" />
          <span>
            Stripe-powered card payments may include processing fees. Fees vary
            by payment method and region. Review Stripe pricing before enabling
            live payments.
          </span>
        </div>
        {stripeConnected ? (
          <Pill tone="accent" icon="check">
            Connected
          </Pill>
        ) : (
          <Button
            variant="primary"
            size="sm"
            icon="card"
            loading={connecting}
            disabled={disabled}
            onClick={connect}
          >
            Connect Stripe (mock)
          </Button>
        )}
        <p className="text-micro text-ink-3 mt-1">
          You can also set this up later from Settings → Client Payments.
        </p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
            <Icon name="wallet" size={16} />
          </span>
          <span className="text-[15px] font-medium text-ink">
            Manual payment
          </span>
        </div>
        <p className="text-small mb-4">
          Show clients custom instructions (bank transfer, Interac, etc.) at
          checkout. Bookings stay pending until you confirm receipt.
        </p>
        <ManualPaymentForm value={value} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

function DonePane() {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-6">
      <span className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center">
        <Icon name="check" size={24} strokeWidth={2.5} />
      </span>
      <div className="flex flex-col gap-2 max-w-md">
        <h2
          className="font-serif text-ink"
          style={{ fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em" }}
        >
          Your workspace is ready
        </h2>
        <p className="text-body text-ink-3">
          You can share your booking page now or come back to refine your
          services, hours, and payment instructions any time.
        </p>
      </div>
      <Link href="/booking" target="_blank" rel="noreferrer">
        <Button variant="secondary" size="md" icon="eye">
          Preview your booking page
        </Button>
      </Link>
    </div>
  );
}

/* ── footer actions ─────────────────────────────────────────────────────── */

function StepFooter({
  step,
  busy,
  onBack,
  onNextFromIntro,
  onSaveService,
  onSaveAvailability,
  onSavePayments,
  onFinish,
}: {
  step: number;
  busy: boolean;
  onBack: () => void;
  onNextFromIntro: () => void;
  onSaveService: () => void;
  onSaveAvailability: () => void;
  onSavePayments: () => void;
  onFinish: () => void;
}) {
  const showBack = step > 0 && step < 4;
  return (
    <div className="flex items-center justify-between gap-3 pt-4 border-t border-line-soft">
      {showBack ? (
        <Button variant="ghost" icon="arrow-left" onClick={onBack} disabled={busy}>
          Back
        </Button>
      ) : (
        <span />
      )}
      {step === 0 && (
        <Button variant="primary" iconRight="arrow-right" onClick={onNextFromIntro}>
          Get started
        </Button>
      )}
      {step === 1 && (
        <Button
          variant="primary"
          iconRight="arrow-right"
          loading={busy}
          onClick={onSaveService}
        >
          Add and continue
        </Button>
      )}
      {step === 2 && (
        <Button
          variant="primary"
          iconRight="arrow-right"
          loading={busy}
          onClick={onSaveAvailability}
        >
          Save availability & continue
        </Button>
      )}
      {step === 3 && (
        <Button
          variant="primary"
          iconRight="arrow-right"
          loading={busy}
          onClick={onSavePayments}
        >
          Save & continue
        </Button>
      )}
      {step === 4 && (
        <Button variant="primary" iconRight="arrow-right" onClick={onFinish}>
          Go to dashboard
        </Button>
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

// Kept around for the partial-progress resume flow (currently disabled for
// visual testing — see the mount effect above).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function resumeStep(
  serviceDone: boolean,
  availabilityDone: boolean,
  paymentsDone: boolean,
): number {
  if (!serviceDone && !availabilityDone && !paymentsDone) return 0;
  if (!serviceDone) return 1;
  if (!availabilityDone) return 2;
  if (!paymentsDone) return 3;
  return 4;
}
