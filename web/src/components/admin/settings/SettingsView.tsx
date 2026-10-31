"use client";

import * as React from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { getAvailabilitySettings, getBusinessSettings, getPaymentSettings, getSettings, type BusinessSettings, type AvailabilitySettings, type PaymentSettings } from "@/services/settings.service";
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
  const [section, setSection] = React.useState<SectionId>("business");
  const [data, setData] = React.useState<SettingsData | null>(null);
  const [business, setBusiness] = React.useState<BusinessSettings | null>(null);
  const [availability, setAvailability] = React.useState<AvailabilitySettings | null>(null);
  const [paymentSettings, setPaymentSettings] = React.useState<PaymentSettings | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const load = async () => {
      try {
        if (dataSource === "api") {
          const [nextBusiness, nextAvailability, nextPayments] = await Promise.all([
            getBusinessSettings(),
            getAvailabilitySettings(),
            getPaymentSettings(),
          ]);
          setBusiness(nextBusiness);
          setAvailability(nextAvailability);
          setPaymentSettings(nextPayments);
          return;
        }
        const settings = await getSettings();
        setData(settings);
        setBusiness(settings.business);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Settings could not be loaded.");
      }
    };
    void load();
  }, []);

  // Platform billing is a real-app concern; the mock demo never shows it.
  const visibleNav = dataSource === "api"
    ? NAV.filter((item) =>
        ["business", "payments", "billing", "calendar", "emails", "account"].includes(item.id)
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
          <div className="eyebrow mb-3">Workspace</div>
          <h1 className="text-h1 text-ink">Settings</h1>
          <p className="text-body text-ink-2 mt-3 max-w-[28ch]">
            Configure your booking workflow, branding, and notifications.
          </p>
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
                  {n.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          {activeMeta && (
            <div className="mb-6">
              <div className="eyebrow mb-2">Settings</div>
              <h2
                className="font-serif text-ink"
                style={{ fontSize: 28, fontWeight: 380, letterSpacing: "-0.015em" }}
              >
                {activeMeta.label}
              </h2>
            </div>
          )}
          {loadError ? (
            <Card padded>
              <p className="text-small text-danger">{loadError}</p>
            </Card>
          ) : !business || (dataSource === "mock" && !data) ? (
            <LoadingRows count={2} />
          ) : (
            <div className="flex flex-col gap-6">
              {section === "business" && (
                <>
                  <BusinessPanel business={business} onChange={handleBusinessChange} />
                  <LocationsCard business={business} onChange={handleBusinessChange} />
                </>
              )}
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
                <ApiEmailsPanel business={business} onChange={handleBusinessChange} />
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
