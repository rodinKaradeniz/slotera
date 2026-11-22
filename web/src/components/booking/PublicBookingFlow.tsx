"use client";

import { TabPanel } from "@/components/ui/Tabs";
import * as React from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouter } from "next/navigation";
import { BookingTopBar } from "@/components/layout/BookingTopBar";
import { BookingFooter } from "@/components/layout/BookingFooter";
import { StepIndicator, STEPS, type StepKey } from "@/components/layout/StepIndicator";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StepService } from "@/components/booking/StepService";
import { StepDateTime } from "@/components/booking/StepDateTime";
import { StepDetails } from "@/components/booking/StepDetails";
import { StepBilling } from "@/components/booking/StepBilling";
import { StepReview } from "@/components/booking/StepReview";
import { StepPayment } from "@/components/booking/StepPayment";
import {
  StepForms,
  areRequiredFormsComplete,
} from "@/components/booking/StepForms";
import { BookingsPausedCard } from "@/components/booking/BookingsPausedCard";
import { EMPTY_DRAFT, type BookingDraft } from "@/components/booking/types";
import { getSettings } from "@/services/settings.service";
import { listFormsForService } from "@/services/forms.service";
import { getPersonaSync } from "@/services/demo.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { SettingsData } from "@/types/settings";
import type { FormTemplate } from "@/types/form";
import type { DemoPersona } from "@/types/demo";
import {
  createPublicBooking,
  currentPublicWorkspaceSlug,
} from "@/services/public-booking.service";
import {
  getClientSession,
  listClientPackages,
  type ClientIdentity,
  type ClientPackage,
} from "@/services/client-access.service";
import { dataSource } from "@/lib/env";
import { PackageChoice } from "@/components/booking/PackageChoice";

const DRAFT_KEY = "slotera.booking.draft";

/**
 * The public booking stepper. Rendered by `/booking` (mock demo) and by
 * `/book/[slug]` (real app), which selects the workspace before rendering.
 */
const NO_FORMS: FormTemplate[] = [];

function readDraft(): BookingDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookingDraft>;
    return {
      ...EMPTY_DRAFT,
      ...parsed,
      formResponses: parsed.formResponses ?? {},
      customer: { ...EMPTY_DRAFT.customer, ...(parsed.customer ?? {}) },
      billing: { ...EMPTY_DRAFT.billing, ...(parsed.billing ?? {}) },
    };
  } catch {
    return null;
  }
}

export function PublicBookingFlow() {
  const { t: uiText } = useI18n();
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = React.useState<StepKey>("service");
  const [draft, setDraft] = React.useState<BookingDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const hydrated = useHydrated();

  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  // `?demo=<slug>` applies a lightweight persona override (provider name +
  // intro copy + which seeded services show). Read client-side to avoid a
  // useSearchParams Suspense boundary, matching the sessionStorage draft.
  const persona = React.useMemo<DemoPersona | null>(
    () =>
      hydrated
        ? getPersonaSync(new URLSearchParams(window.location.search).get("demo"))
        : null,
    [hydrated],
  );

  // Active forms attached to the chosen service decide whether the conditional
  // Forms step appears. Refetch whenever the selected service changes.
  const serviceId = draft.service?.id ?? null;
  const [loadedForms, setLoadedForms] = React.useState<{
    serviceId: string;
    forms: FormTemplate[];
  } | null>(null);
  const forms =
    serviceId && loadedForms?.serviceId === serviceId ? loadedForms.forms : NO_FORMS;
  React.useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    listFormsForService(serviceId).then((f) => {
      if (!cancelled) setLoadedForms({ serviceId, forms: f.filter((form) => form.requiredBeforePayment) });
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  // A client signed in to this workspace can book with a paid package that covers the
  // service. Guests (no client session) simply don't get the option.
  const [client, setClient] = React.useState<{ identity: ClientIdentity; packages: ClientPackage[] } | null>(null);
  React.useEffect(() => {
    const slug = currentPublicWorkspaceSlug();
    if (dataSource !== "api" || !slug) return;
    const controller = new AbortController();
    getClientSession(controller.signal)
      .then(async (identity) => {
        if (identity.slug !== slug) return;
        const { items } = await listClientPackages(controller.signal);
        if (!controller.signal.aborted) setClient({ identity, packages: items });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  // Signed in, the booking is the account's: its email is used and its name is filled in.
  const identity = client?.identity;
  const covering = (client?.packages ?? []).filter((item) => item.status === "active" && item.paymentStatus === "paid"
    && item.sessions.some((session) => session.serviceId === serviceId && !session.bookedFor));
  const chosenPackage = draft.packagePurchaseId === ""
    ? undefined
    : covering.find((item) => item.id === draft.packagePurchaseId) ?? covering[0];
  // What the later steps and the request see: the package in use, or none.
  const effective = { ...draft, packagePurchaseId: chosenPackage?.id ?? null };

  // Drop the Forms step when the chosen service has no attached forms, and Billing for a
  // free or package-covered session (nothing is invoiced, and the server doesn't ask for an address).
  const free = draft.service?.priceCents === 0 || !!chosenPackage;
  const activeSteps = React.useMemo(
    () => STEPS.filter((s) => (s.key !== "forms" || forms.length > 0) && (s.key !== "billing" || !free)),
    [forms.length, free],
  );

  // Restore an unfinished draft once the browser's storage is readable.
  const [restored, setRestored] = React.useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    const saved = readDraft();
    if (saved) setDraft(saved);
  }
  if (identity && restored && draft.customer.email !== identity.email) {
    const [firstName, ...rest] = identity.name.split(" ");
    setDraft({ ...draft, customer: { ...draft.customer, email: identity.email,
      firstName: draft.customer.firstName || firstName, lastName: draft.customer.lastName || rest.join(" ") } });
  }

  React.useEffect(() => {
    // Saving before the restore would overwrite the draft with an empty one.
    if (!restored) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft, restored]);

  const idx = activeSteps.findIndex((s) => s.key === step);

  // If the active step list changes out from under us (e.g. the Forms step
  // disappears), snap back to a valid step rather than rendering nothing.
  if (idx === -1 && step !== "details") setStep("details");

  const canAdvance = (() => {
    switch (step) {
      case "service":
        return !!draft.service;
      case "time":
        return !!draft.date && !!draft.time && !!draft.startAt;
      case "details":
        return (
          draft.customer.firstName.trim() &&
          draft.customer.lastName.trim() &&
          draft.customer.email.trim() &&
          draft.customer.consent
        );
      case "forms":
        return areRequiredFormsComplete(forms, draft.formResponses);
      case "billing":
        return (
          draft.billing.street.trim() &&
          draft.billing.zip.trim() &&
          draft.billing.city.trim()
        );
      case "review":
        return true;
      case "pay":
        // The server accepts free bookings, a package, or manual payment when the operator allows it.
        return free || settings?.payments.manualPaymentEnabled === true;
      default:
        return false;
    }
  })();

  const back = () => {
    if (idx <= 0) return;
    setStep(activeSteps[idx - 1].key);
    setError(null);
  };

  const next = () => {
    if (!canAdvance) return;
    if (step === "pay") {
      submit();
      return;
    }
    setStep(activeSteps[idx + 1].key);
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const booking = await createPublicBooking(effective);
      window.sessionStorage.setItem(
        "slotera.booking.last",
        JSON.stringify({
          ref: booking.reference,
          draft: effective,
          booking,
          slug: currentPublicWorkspaceSlug(),
          providerName: settings?.business.displayName,
          branded: settings?.business.showPlatformBranding ?? true,
          branding: settings?.branding,
        }),
      );
      window.sessionStorage.removeItem(DRAFT_KEY);
      router.push("/booking/confirmation");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : uiText("ui.the.booking.could.not.be.completed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // While settings are loading, render a quiet placeholder rather than the
  // stepper — otherwise the operator could see the full form for a frame
  // before the paused card replaces it.
  const branded = settings?.business.showPlatformBranding ?? true;
  if (settings === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <BookingTopBar />
        <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-10 pb-10">
          <div className="flex flex-col gap-3 max-w-md mx-auto">
            <Skeleton h={28} />
            <Skeleton h={20} />
            <Skeleton h={20} w="60%" />
          </div>
        </main>
        <BookingFooter branded={false} />
      </div>
    );
  }

  if (!settings.business.bookingPageEnabled) {
    return (
      <div className="min-h-screen flex flex-col">
        <BookingTopBar consultantName={settings.business.displayName} />
        <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-16 pb-10">
          <BookingsPausedCard displayName={settings.business.displayName} />
        </main>
        <BookingFooter branded={branded} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <BookingTopBar consultantName={settings.business.displayName} />
      <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-10 pb-10">
        {persona && (
          <p className="text-small text-ink-2 text-center mb-6 max-w-xl mx-auto">
            {persona.intro}
          </p>
        )}
        <div className="mb-10 px-2 sm:px-6">
          <StepIndicator
            current={step}
            steps={activeSteps.map((s) => ({
              key: s.key,
              label: s.key === "pay" && free ? t("booking.step.confirm") : t(`booking.step.${s.key}`),
            }))}
          />
        </div>

        <TabPanel
          value={step}
          order={activeSteps.map((s) => s.key)}
          className="flex flex-col min-h-[clamp(420px,60vh,640px)] [&>*]:flex-1"
        >
          {step === "service" && (
            <div>
              <StepService
                selected={draft.service}
                onSelect={(s) => setDraft({ ...draft, service: s, packagePurchaseId: null })}
                persona={persona}
              />
              {draft.service && covering.length > 0 && (
                <PackageChoice
                  packages={covering}
                  serviceId={draft.service.id}
                  chosenId={chosenPackage?.id ?? ""}
                  onChange={(packagePurchaseId) => setDraft({ ...draft, packagePurchaseId })}
                />
              )}
            </div>
          )}
          {step === "time" && draft.service && (
            <StepDateTime
              service={draft.service}
              date={draft.date}
              time={draft.time}
              startAt={draft.startAt}
              onChange={(p) => setDraft({ ...draft, ...p })}
            />
          )}
          {step === "details" && (
            <Card padded>
              <StepDetails
                customer={draft.customer}
                emailLocked={!!identity}
                onChange={(customer) => setDraft({ ...draft, customer })}
                providerBookingTerms={settings?.payments.bookingTerms}
              />
            </Card>
          )}
          {step === "forms" && (
            <StepForms
              forms={forms}
              responses={draft.formResponses}
              onChange={(formResponses) => setDraft({ ...draft, formResponses })}
            />
          )}
          {step === "billing" && (
            <Card padded>
              <StepBilling
                billing={draft.billing}
                onChange={(billing) => setDraft({ ...draft, billing })}
              />
            </Card>
          )}
          {step === "review" && (
            <StepReview
              draft={effective}
              onEdit={(s) => setStep(s)}
            />
          )}
          {step === "pay" && (
            <StepPayment draft={effective} />
          )}
        </TabPanel>

        {error && (
          <div className="mt-6 text-small text-danger">{error}</div>
        )}

        <div className="flex items-center justify-between mt-10 gap-3">
          <Button
            variant="ghost"
            size="md"
            icon="arrow-left"
            onClick={back}
            disabled={idx === 0}
          >
            {t("booking.back")}
          </Button>
          <Button
            variant="primary"
            size="md"
            iconRight={step === "pay" ? undefined : "arrow-right"}
            onClick={next}
            disabled={!canAdvance}
            loading={submitting}
          >
            {step === "pay"
              ? free
                ? t("booking.confirm")
                : t("booking.reservePay")
              : t("booking.continue")}
          </Button>
        </div>
      </main>
      <BookingFooter branded={branded} />
    </div>
  );
}
