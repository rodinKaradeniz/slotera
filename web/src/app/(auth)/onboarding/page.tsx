"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
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
import { currentSession } from "@/services/auth.service";
import { createService, listServices } from "@/services/services.service";
import {
  availabilityToWorkingDays,
  completeOnboarding,
  getAvailabilitySettings,
  getBusinessSettings,
  getPaymentSettings,
  updateAvailabilitySettings,
  updatePaymentSettings,
  workingDaysToWeeklyHours,
  type AvailabilitySettings,
  type PaymentSettings,
} from "@/services/settings.service";
import type { WorkingDay } from "@/types/settings";
import { cn } from "@/lib/cn";

/* ──────────────────────────────────────────────────────────────────────────
   Onboarding is a five-pane linear stepper:
     0 — Intro
     1 — Create your first service
     2 — Set availability
     3 — Set up payments
     4 — Done

   Real app only (the route 404s in the mock demo). On mount, completion is
   derived from the workspace's services, availability and payment settings,
   and the stepper jumps to the first incomplete pane. "Skip for now" and
   "Go to dashboard" both mark onboarding complete on the server.
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
  currency: "EUR",
  capacity: 1,
  locationType: "online",
  location: "Zoom · link sent on confirmation",
  bookingMode: "open",
  confirmationPolicy: "automatic",
  cancellationRule: "Free reschedule up to 12h before.",
  active: true,
};

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<number>(0);
  const [availability, setAvailability] = React.useState<AvailabilitySettings | null>(null);
  const [payments, setPayments] = React.useState<PaymentSettings | null>(null);
  const [bookingSlug, setBookingSlug] = React.useState<string>("");
  const [ready, setReady] = React.useState(false);

  const [operatorName, setOperatorName] = React.useState<string>("there");
  const [serviceForm, setServiceForm] =
    React.useState<ServiceFormValue>(DEFAULT_SERVICE);
  const [hours, setHours] = React.useState<WorkingDay[]>([]);
  const [manualPayment, setManualPayment] = React.useState<ManualPaymentValue>({
    enabled: false,
    instructions: "",
  });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const session = currentSession();
    const first = session?.operator.firstNames?.trim().split(/\s+/)[0];
    if (first) setOperatorName(first);

    let cancelled = false;
    (async () => {
      try {
        const [business, services, nextAvailability, nextPayments] = await Promise.all([
          getBusinessSettings(),
          listServices(),
          getAvailabilitySettings(),
          getPaymentSettings(),
        ]);
        if (cancelled) return;
        setBookingSlug(business.bookingPageUrl);
        setAvailability(nextAvailability);
        // A brand-new workspace has no hours yet; suggest a working week to edit.
        setHours(
          availabilityToWorkingDays(nextAvailability).map((day) =>
            nextAvailability.weeklyHours.length === 0 && (day.dayOfWeek ?? 7) <= 5
              ? { ...day, enabled: true }
              : day,
          ),
        );
        setPayments(nextPayments);
        setManualPayment({
          enabled: nextPayments.manualPaymentEnabled,
          instructions: nextPayments.manualPaymentInstructions,
        });
        // Resume from server state so a half-finished setup picks up where it stopped.
        setStep(
          resumeStep(
            services.length > 0,
            nextAvailability.weeklyHours.length > 0,
            nextPayments.manualPaymentEnabled,
          ),
        );
        setReady(true);
      } catch (err) {
        toast.error("Couldn't load your workspace", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Done and Skip both close onboarding for good; settings stay editable later.
  const finish = async () => {
    try {
      await completeOnboarding();
    } finally {
      router.push("/admin/dashboard");
    }
  };

  const saveService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error("Give your service a name first.");
      return;
    }
    setBusy(true);
    try {
      await createService(serviceForm);
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
    if (!availability) return;
    const weeklyHours = workingDaysToWeeklyHours(hours);
    if (weeklyHours.length === 0) {
      toast.error("Enable at least one day so clients can book.");
      return;
    }
    setBusy(true);
    try {
      setAvailability(await updateAvailabilitySettings({ ...availability, weeklyHours }));
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
    if (!payments) return;
    setBusy(true);
    try {
      setPayments(
        await updatePaymentSettings({
          ...payments,
          manualPaymentEnabled: manualPayment.enabled,
          manualPaymentInstructions: manualPayment.instructions,
        }),
      );
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
          onClick={finish}
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
                    disabled={busy}
                  />
                )}
                {step === 4 && <DonePane bookingSlug={bookingSlug} />}
              </div>

              <StepFooter
                step={step}
                busy={busy}
                onBack={() => setStep((s) => Math.max(0, s - 1))}
                onNextFromIntro={() => setStep(1)}
                onSaveService={saveService}
                onSaveAvailability={saveAvailability}
                onSavePayments={savePayments}
                onFinish={finish}
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
      body: "Manual bank-transfer instructions, or skip it if your services are free.",
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
  disabled,
}: {
  value: ManualPaymentValue;
  onChange: (next: ManualPaymentValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
            <Icon name="wallet" size={16} />
          </span>
          <span className="text-[15px] font-medium text-ink">Manual payment</span>
        </div>
        <p className="text-small mb-4">
          Show clients custom instructions (bank transfer, Interac, etc.) at
          checkout. Bookings stay pending until you confirm receipt. Free
          services need no payment setup.
        </p>
        <ManualPaymentForm value={value} onChange={onChange} disabled={disabled} />
      </div>
      <div className="flex items-start gap-2 rounded-md border border-line-soft bg-paper-2 px-3 py-2 text-small text-ink-2">
        <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink-3" />
        <span>
          Card payments are coming soon. You&apos;ll be able to connect them from
          Settings → Client Payments.
        </span>
      </div>
    </div>
  );
}

function DonePane({ bookingSlug }: { bookingSlug: string }) {
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
      <Link href={`/book/${bookingSlug}`} target="_blank" rel="noreferrer">
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
