"use client";
import { useSettingsEdit } from "@/components/shared/use-settings-edit";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  ServiceForm,
  type ServiceFormValue,
} from "@/components/shared/forms/ServiceForm";
import { WorkingHoursForm } from "@/components/shared/forms/WorkingHoursForm";
import { type ManualPaymentValue } from "@/components/shared/forms/ManualPaymentForm";
import { currentSession } from "@/services/auth.service";
import { createService, listServicePage } from "@/services/services.service";
import {
  availabilityToWorkingDays,
  completeOnboarding,
  getAvailabilitySettings,
  getBusinessSettings,
  getPaymentSettings,
  getWorkspaceCurrency,
  updateAvailabilitySettings,
  updatePaymentSettings,
  workingDaysToWeeklyHours,
  type AvailabilitySettings,
  type PaymentSettings,
} from "@/services/settings.service";
import type { WorkingDay } from "@/types/settings";
import { StepHeader, StepIndicator, IntroPane, PaymentsPane, DonePane, StepFooter, resumeStep } from "@/components/onboarding/OnboardingSteps";

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
  confirmationPolicy: "automatic",
  cancellationRule: "Free reschedule up to 12h before.",
  active: true,
};

export default function OnboardingPage() {
  const { t: uiText } = useI18n();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<number>(0);
  const [availability, setAvailability] = React.useState<AvailabilitySettings | null>(null);
  const [payments, setPayments] = React.useState<PaymentSettings | null>(null);
  const [bookingSlug, setBookingSlug] = React.useState<string>("");
  const [ready, setReady] = React.useState(false);

  const hydrated = useHydrated();
  const operatorName =
    (hydrated && currentSession()?.operator.firstNames?.trim().split(/\s+/)[0]) || "there";
  const [serviceForm, setServiceForm] =
    React.useState<ServiceFormValue>(DEFAULT_SERVICE);
  const [hours, setHours] = React.useState<WorkingDay[]>([]);
  const [manualPayment, setManualPayment] = React.useState<ManualPaymentValue>({
    enabled: false,
    instructions: "",
  });
  const [busy, setBusy] = React.useState(false);
  const availabilityEdit = useSettingsEdit(availability, getAvailabilitySettings, (next) => {
    setAvailability(next); setHours(availabilityToWorkingDays(next));
  });
  const paymentEdit = useSettingsEdit(payments, getPaymentSettings, (next) => {
    setPayments(next); setManualPayment({enabled: next.manualPaymentEnabled, instructions: next.manualPaymentInstructions});
  });


  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [business, services, nextAvailability, nextPayments, currency] = await Promise.all([
          getBusinessSettings(),
          listServicePage({}),
          getAvailabilitySettings(),
          getPaymentSettings(),
          getWorkspaceCurrency(),
        ]);
        if (cancelled) return;
        setServiceForm((form) => ({ ...form, currency }));
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
            services.total > 0,
            nextAvailability.weeklyHours.length > 0,
            nextPayments.manualPaymentEnabled,
          ),
        );
        setReady(true);
      } catch (err) {
        toast.error(uiText("ui.couldn.t.load.your.workspace"), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast, uiText]);

  // Done and Skip both close onboarding for good; settings stay editable later.
  const finish = async () => {
    try {
      await completeOnboarding();
      router.push("/admin/dashboard");
    } catch (error) {
      toast.error(uiText("errors.unexpected"), {description: error instanceof Error ? error.message : undefined});
    }
  };

  const saveService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error(uiText("ui.give.your.service.a.name.first"));
      return;
    }
    setBusy(true);
    try {
      await createService(serviceForm);
      toast.success(uiText("ui.service.created"));
      setStep(2);
    } catch (err) {
      toast.error(uiText("ui.couldn.t.create.service"), {
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
      toast.error(uiText("ui.enable.at.least.one.day.so.clients.can.book"));
      return;
    }
    setBusy(true);
    try {
      const next = await updateAvailabilitySettings({ ...availability, weeklyHours });
      setAvailability(next); availabilityEdit.accept({...next, id: "settings"});
      if (payments && payments.version === availability.version) {
        const currentPayments = {...payments, version: next.version};
        setPayments(currentPayments); paymentEdit.accept({...currentPayments, id: "settings"});
      }
      toast.success(uiText("ui.availability.saved"));
      setStep(3);
    } catch (err) {
      availabilityEdit.onError(err);
      toast.error(uiText("ui.couldn.t.save.availability"), {
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
      toast.success(uiText("ui.payment.setup.saved"));
      setStep(4);
    } catch (err) {
      paymentEdit.onError(err);
      toast.error(uiText("ui.couldn.t.save.payment.setup"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      {step === 2 && availabilityEdit.notice}
      {step === 3 && paymentEdit.notice}
      <div className="flex items-center justify-between mb-6">
        <Logo />
        <button
          type="button"
          onClick={finish}
          className="text-small text-ink-3 hover:text-ink"
        >
          {uiText("ui.skip.for.now")}</button>
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
