"use client";
import { DATA_CHANGED } from "@/api/query-cache";
import { translateInterfaceLabel } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { getAvailabilitySettings, getBusinessSettings, getPaymentSettings, getSettings, type BusinessSettings, type AvailabilitySettings, type PaymentSettings } from "@/services/settings.service";
import { ApiBrandingPanel } from "./ApiBrandingPanel";
import { ApiBillingPanel } from "./ApiBillingPanel";
import { WorkspaceDataCard } from "./WorkspaceDataCard";
import type { SettingsData } from "@/types/settings";
import { cn } from "@/lib/cn";
import { dataSource } from "@/lib/env";
import { BusinessPanel } from "./BusinessPanel";
import { BrandingPanel } from "./BrandingPanel";
import { LocationsCard } from "./LocationsCard";
import { PaymentsPanel, ApiPaymentsPanel } from "./PaymentsPanels";
import { CalendarPanel, ApiCalendarPanel } from "./CalendarPanels";
import { ApiEmailsPanel, EmailsPanel } from "./EmailsPanels";
import { ApiAccountPanel, AccountPanel } from "./AccountPanels";

type SectionId =
  | "business"
  | "branding"
  | "payments"
  | "billing"
  | "calendar"
  | "emails"
  | "account";

const NAV: { id: SectionId; label: string; icon: IconName }[] = [
  { id: "business", label: "Business Profile",        icon: "briefcase" },
  { id: "branding", label: "Branding",                icon: "sparkle" },
  { id: "payments", label: "Client Payments",         icon: "card" },
  { id: "billing",  label: "Billing & Subscription",  icon: "wallet" },
  { id: "calendar", label: "Calendar",                icon: "calendar" },
  { id: "emails",   label: "Emails",                  icon: "mail" },
  { id: "account",  label: "Account",                 icon: "user" },
];

export function SettingsView() {
  const { t: uiText, lang: labelLang } = useI18n();
  const [section, setSection] = React.useState<SectionId>("business");
  const [data, setData] = React.useState<SettingsData | null>(null);
  const [business, setBusiness] = React.useState<BusinessSettings | null>(null);
  const [availability, setAvailability] = React.useState<AvailabilitySettings | null>(null);
  const [paymentSettings, setPaymentSettings] = React.useState<PaymentSettings | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [readAttempt, setReadAttempt] = React.useState(0);
  React.useEffect(() => {
    const refresh = () => setReadAttempt((value) => value + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => window.removeEventListener(DATA_CHANGED, refresh);
  }, []);
  React.useEffect(() => {
    const load = async () => {
      try {
        if (dataSource === "api") {
          if (["business", "emails"].includes(section)) setBusiness(await getBusinessSettings());
          if (section === "calendar") setAvailability(await getAvailabilitySettings());
          if (section === "payments") setPaymentSettings(await getPaymentSettings());
          setLoadError(null);
          return;
        }
        const settings = await getSettings();
        setData(settings);
        setBusiness(settings.business);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    };
    void load();
  }, [section, readAttempt]);

  // Platform billing is a real-app concern; the mock demo never shows it.
  const visibleNav = dataSource === "api"
    ? NAV.filter((item) =>
        ["business", "branding", "payments", "billing", "calendar", "emails", "account"].includes(item.id)
      )
    : NAV.filter((item) => item.id !== "billing");
  const activeMeta = visibleNav.find((n) => n.id === section);
  const handleBusinessChange = (next: BusinessSettings) => {
    setBusiness(next);
    setData((current) => (current ? { ...current, business: next } : current));
  };
  return (
    <PageContainer>
      <div className="grid lg:grid-cols-[280px_1fr] gap-10 items-start">
        <aside className="flex flex-col lg:sticky lg:top-24">
          <div className="eyebrow mb-3">{uiText("ui.workspace")}</div>
          <h1 className="text-h1 text-ink">{uiText("ui.settings")}</h1>
          <p className="text-body text-ink-2 mt-3 max-w-[28ch]">
            {uiText("ui.configure.your.booking.workflow.branding.and.notifications")}</p>
          <nav className="flex flex-col gap-1 mt-8">
            {visibleNav.map((n) => {
              const active = section === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSection(n.id)}
                  className={cn(
                    "flex items-center gap-2.5 h-10 px-3 rounded-md text-[14px] transition-colors text-left",
                    active
                      ? "bg-accent-soft text-accent-ink font-medium"
                      : "text-ink-2 hover:bg-paper-2",
                  )}
                >
                  <Icon name={n.icon} size={16} />
                  {translateInterfaceLabel(labelLang, n.label)}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          {activeMeta && (
            <div className="mb-6">
              <div className="eyebrow mb-2">{uiText("ui.settings")}</div>
              <h2
                className="font-serif text-ink"
                style={{ fontSize: 28, fontWeight: 380, letterSpacing: "-0.015em" }}
              >
                {translateInterfaceLabel(labelLang, activeMeta.label)}
              </h2>
            </div>
          )}
          {loadError && (
            <Card padded>
              <p className="text-small text-danger">{loadError}</p>
              <Button variant="secondary" onClick={() => setReadAttempt((value) => value + 1)}>{uiText("forms.retry")}</Button>
            </Card>
          )}
          {(dataSource === "api" ? (["business", "emails"].includes(section) && !business) || (section === "calendar" && !availability) || (section === "payments" && !paymentSettings) : !business || !data) ? (
            !loadError && <LoadingRows count={2} />
          ) : (
            <div className="flex flex-col gap-6">
              {section === "business" && (
                <>
                  <BusinessPanel business={business!} onChange={handleBusinessChange} />
                  <LocationsCard business={business!} onChange={handleBusinessChange} />
                </>
              )}
              {section === "branding" && dataSource === "api" && <ApiBrandingPanel />}
              {section === "branding" && data && <BrandingPanel data={data} onChange={setData} />}
              {section === "payments" && data && <PaymentsPanel data={data} onChange={setData} />}
              {section === "payments" && dataSource === "api" && paymentSettings && (
                <ApiPaymentsPanel
                  payments={paymentSettings}
                  onChange={setPaymentSettings}
                />
              )}
              {section === "billing" && dataSource === "api" && <ApiBillingPanel />}
              {section === "calendar" && dataSource === "api" && availability && (
                <ApiCalendarPanel
                  availability={availability}
                  onChange={setAvailability}
                />
              )}
              {section === "calendar" && dataSource === "mock" && data && (
                <CalendarPanel data={data} onChange={setData} />
              )}
              {section === "emails" && dataSource === "api" && (
                <ApiEmailsPanel business={business!} onChange={handleBusinessChange} />
              )}
              {section === "emails" && dataSource === "mock" && data && (
                <EmailsPanel data={data} onChange={setData} />
              )}
              {section === "account" && dataSource === "api" && <ApiAccountPanel />}
              {section === "account" && dataSource === "api" && <WorkspaceDataCard />}
              {section === "account" && dataSource === "mock" && data && (
                <AccountPanel data={data} onChange={setData} />
              )}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
