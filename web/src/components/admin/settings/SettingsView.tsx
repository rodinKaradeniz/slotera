"use client";

import * as React from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { LoadingRows } from "@/components/shared/LoadingRows";
import {
  AddressForm,
  formatAddressSummary,
} from "@/components/shared/forms/AddressForm";
import { ManualPaymentForm } from "@/components/shared/forms/ManualPaymentForm";
import { WorkingHoursForm } from "@/components/shared/forms/WorkingHoursForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  createWorkspaceLocation,
  deleteWorkspaceLocation,
  getAvailabilitySettings,
  getBusinessSettings,
  getSettings,
  updateBusinessSettings,
  updateAvailabilitySettings,
  updateSettings,
  updateWorkspaceLocation,
  type BusinessSettings,
  type AvailabilitySettings,
} from "@/services/settings.service";
import { BillingPanel } from "./BillingPanel";
import { EMPTY_ADDRESS, type WorkspaceLocation } from "@/types/address";
import type { SettingsData, WorkingDay } from "@/types/settings";
import { cn } from "@/lib/cn";
import { dataSource } from "@/lib/env";

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
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const load = async () => {
      try {
        if (dataSource === "api") {
          const [nextBusiness, nextAvailability] = await Promise.all([
            getBusinessSettings(),
            getAvailabilitySettings(),
          ]);
          setBusiness(nextBusiness);
          setAvailability(nextAvailability);
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

  const visibleNav = dataSource === "api"
    ? NAV.filter((item) => item.id === "business" || item.id === "calendar")
    : NAV;
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
              {section === "billing" && <BillingPanel />}
              {section === "calendar" && dataSource === "api" && availability && (
                <ApiCalendarPanel
                  availability={availability}
                  onChange={setAvailability}
                />
              )}
              {section === "calendar" && dataSource === "mock" && data && (
                <CalendarPanel data={data} onChange={setData} />
              )}
              {section === "emails" && data && <EmailsPanel data={data} onChange={setData} />}
              {section === "account" && data && <AccountPanel data={data} onChange={setData} />}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

type PanelProps = {
  data: SettingsData;
  onChange: (next: SettingsData) => void;
};

function PanelCard({
  title,
  hint,
  children,
  onSave,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  onSave?: () => void;
}) {
  return (
    <Card padded>
      <div className="mb-4">
        <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>{title}</h2>
        {hint && <p className="text-small mt-1">{hint}</p>}
      </div>
      {children}
      {onSave && (
        <div className="flex justify-end mt-5 pt-4 border-t border-line-soft">
          <Button variant="primary" onClick={onSave}>Save changes</Button>
        </div>
      )}
    </Card>
  );
}

function BusinessPanel({
  business,
  onChange,
}: {
  business: BusinessSettings;
  onChange: (next: BusinessSettings) => void;
}) {
  const [local, setLocal] = React.useState(business);
  const save = async () => {
    const next = await updateBusinessSettings({
      name: local.name,
      displayName: local.displayName,
      bio: local.bio,
      email: local.email,
      phone: local.phone,
      address: local.address,
      bookingPageUrl: local.bookingPageUrl,
      bookingPageEnabled: local.bookingPageEnabled,
    });
    onChange(next);
  };
  return (
    <PanelCard
      title="Business Profile"
      hint="Visible on your public booking page."
      onSave={save}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Business name">
          <Input
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
          />
        </Field>
        <Field label="Display name">
          <Input
            value={local.displayName}
            onChange={(e) => setLocal({ ...local, displayName: e.target.value })}
          />
        </Field>
        <Field label="Bio" className="sm:col-span-2">
          <Textarea
            value={local.bio}
            rows={3}
            onChange={(e) => setLocal({ ...local, bio: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <Input
            value={local.email}
            onChange={(e) => setLocal({ ...local, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={local.phone}
            onChange={(e) => setLocal({ ...local, phone: e.target.value })}
          />
        </Field>
        <Field
          label={dataSource === "api" ? "Workspace slug" : "Booking page URL"}
          className="sm:col-span-2"
        >
          <Input
            value={local.bookingPageUrl}
            disabled={dataSource === "api"}
            onChange={(e) =>
              setLocal({ ...local, bookingPageUrl: e.target.value })
            }
          />
        </Field>
      </div>
    </PanelCard>
  );
}

function BrandingPanel({ data, onChange }: PanelProps) {
  const [local, setLocal] = React.useState(data.branding);
  const save = async () => {
    const next = await updateSettings({ branding: local });
    onChange(next);
  };
  return (
    <PanelCard title="Branding" hint="Used across emails and the booking page." onSave={save}>
      <Field label="Accent color">
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-md border border-line"
            style={{ background: local.accent }}
          />
          <Input
            value={local.accent}
            onChange={(e) => setLocal({ ...local, accent: e.target.value })}
            className="max-w-[180px]"
          />
        </div>
      </Field>
      <Field label="Display font" className="mt-4">
        <Select
          value={local.fontFamily}
          onChange={(e) =>
            setLocal({ ...local, fontFamily: e.target.value as "serif" | "sans" })
          }
          options={[
            { value: "serif", label: "Serif (Fraunces)" },
            { value: "sans", label: "Sans (Inter Tight)" },
          ]}
        />
      </Field>
    </PanelCard>
  );
}

function PaymentsPanel({ data, onChange }: PanelProps) {
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

function ManualPaymentPanel({ data, onChange }: PanelProps) {
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

function BookingTermsPanel({ data, onChange }: PanelProps) {
  const [value, setValue] = React.useState({
    enabled: data.payments.bookingTerms.enabled,
    content: data.payments.bookingTerms.content,
  });

  const save = async () => {
    const next = await updateSettings({
      payments: {
        ...data.payments,
        bookingTerms: value,
      },
    });
    onChange(next);
  };

  return (
    <PanelCard
      title="Booking Terms"
      hint="Your own booking terms. Shown to clients during checkout, separate from Slotera's platform terms."
      onSave={save}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-4 border-b border-line-soft">
          <div>
            <div className="text-[14px] font-medium text-ink">
              Enable custom booking terms
            </div>
            <div className="text-small">
              Shown to clients on the booking page when they open the Terms and Privacy modal.
            </div>
          </div>
          <Toggle
            checked={value.enabled}
            onChange={(enabled) => setValue({ ...value, enabled })}
          />
        </div>
        <Field
          label="Terms content"
          hint="Plain text. Cancellation window, refund policy, no-show rules, etc."
        >
          <Textarea
            value={value.content}
            rows={8}
            disabled={!value.enabled}
            placeholder="Cancellations and rescheduling are free up to 24 hours before your session..."
            onChange={(e) => setValue({ ...value, content: e.target.value })}
          />
        </Field>
      </div>
    </PanelCard>
  );
}

function CalendarPanel({ data, onChange }: PanelProps) {
  const [hours, setHours] = React.useState<WorkingDay[]>(data.calendar.workingHours);
  const save = async () => {
    const next = await updateSettings({
      calendar: { ...data.calendar, workingHours: hours },
    });
    onChange(next);
  };
  return (
    <>
      <Card padded>
        <div className="mb-4">
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>Calendar Connections</h2>
          <p className="text-small mt-1">Two-way sync prevents double-booking.</p>
        </div>
        {data.calendar.connections.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0"
          >
            <span className="w-9 h-9 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
              <Icon name="calendar" size={16} />
            </span>
            <div className="flex-1">
              <div className="text-[14px] font-medium text-ink">{c.label}</div>
              <div className="text-small">{c.detail}</div>
            </div>
            <Pill tone={c.status === "connected" ? "accent" : "neutral"}>
              {c.status === "connected" ? "Connected" : "Not connected"}
            </Pill>
            <Button variant="secondary" size="sm">
              {c.status === "connected" ? "Manage" : "Connect"}
            </Button>
          </div>
        ))}
      </Card>

      <PanelCard title="Working Hours" onSave={save}>
        <WorkingHoursForm value={hours} onChange={setHours} />
      </PanelCard>
    </>
  );
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function availabilityWorkingDays(availability: AvailabilitySettings): WorkingDay[] {
  const days: WorkingDay[] = [];
  WEEKDAY_LABELS.forEach((day, index) => {
    const dayOfWeek = index + 1;
    const windows = availability.weeklyHours.filter(
      (window) => window.dayOfWeek === dayOfWeek,
    );
    if (windows.length === 0) {
      days.push({ day, dayOfWeek, enabled: false, start: "09:00", end: "17:00" });
      return;
    }
    days.push(
      ...windows.map((window) => ({
        day,
        dayOfWeek,
        enabled: true,
        start: window.startLocal,
        end: window.endLocal,
      })),
    );
  });
  return days;
}

function ApiCalendarPanel({
  availability,
  onChange,
}: {
  availability: AvailabilitySettings;
  onChange: (next: AvailabilitySettings) => void;
}) {
  const { toast } = useToast();
  const [local, setLocal] = React.useState(availability);
  const [hours, setHours] = React.useState<WorkingDay[]>(() =>
    availabilityWorkingDays(availability),
  );
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const weeklyHours = hours
      .filter((day) => day.enabled)
      .map((day) => ({
        dayOfWeek: day.dayOfWeek ?? WEEKDAY_LABELS.indexOf(day.day) + 1,
        startLocal: day.start,
        endLocal: day.end,
      }));
    setSaving(true);
    try {
      const next = await updateAvailabilitySettings({ ...local, weeklyHours });
      setLocal(next);
      setHours(availabilityWorkingDays(next));
      onChange(next);
      toast.success("Calendar settings saved");
    } catch (error) {
      toast.error("Couldn't save calendar settings", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const numericField = (
    key:
      | "slotIntervalMin"
      | "bufferBeforeMin"
      | "bufferAfterMin"
      | "minimumNoticeMin"
      | "maximumAdvanceDays",
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setLocal({ ...local, [key]: Number.isFinite(value) ? value : 0 });
  };

  return (
    <>
      <PanelCard
        title="Calendar Connections"
        hint="External calendar connections remain display-only in this local API bundle."
      >
        <p className="text-small text-ink-2">
          Google Calendar, Apple Calendar, and Outlook sync are not connected yet.
        </p>
      </PanelCard>

      <Card padded>
        <div className="mb-4">
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>Availability</h2>
          <p className="text-small mt-1">
            These workspace-wide rules shape future public availability. They do not
            create bookings or consume session capacity.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <Field label="Workspace timezone">
            <Input
              value={local.timezone}
              onChange={(event) => setLocal({ ...local, timezone: event.target.value })}
              placeholder="Europe/Berlin"
            />
          </Field>
          <Field label="Slot interval (min)">
            <Input type="number" min={5} value={String(local.slotIntervalMin)} onChange={numericField("slotIntervalMin")} />
          </Field>
          <Field label="Buffer before (min)">
            <Input type="number" min={0} value={String(local.bufferBeforeMin)} onChange={numericField("bufferBeforeMin")} />
          </Field>
          <Field label="Buffer after (min)">
            <Input type="number" min={0} value={String(local.bufferAfterMin)} onChange={numericField("bufferAfterMin")} />
          </Field>
          <Field label="Minimum notice (min)">
            <Input type="number" min={0} value={String(local.minimumNoticeMin)} onChange={numericField("minimumNoticeMin")} />
          </Field>
          <Field label="Maximum advance (days)">
            <Input type="number" min={1} value={String(local.maximumAdvanceDays)} onChange={numericField("maximumAdvanceDays")} />
          </Field>
        </div>
        <div className="border-t border-line-soft pt-5">
          <h3 className="text-[13px] font-medium text-ink mb-2">Working hours</h3>
          <WorkingHoursForm value={hours} onChange={setHours} disabled={saving} />
        </div>
        <div className="flex justify-end mt-5 pt-4 border-t border-line-soft">
          <Button variant="primary" onClick={save} loading={saving}>Save availability</Button>
        </div>
      </Card>

      {local.blackouts.length > 0 && (
        <PanelCard
          title="Blackout dates"
          hint="Existing blackout ranges are preserved when availability is saved."
        >
          <div className="flex flex-col gap-2">
            {local.blackouts.map((blackout) => (
              <div key={blackout.id ?? `${blackout.startsAt}-${blackout.endsAt}`} className="text-small text-ink-2">
                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(blackout.startsAt))}
                {" – "}
                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(blackout.endsAt))}
                {blackout.reason ? ` · ${blackout.reason}` : ""}
              </div>
            ))}
          </div>
        </PanelCard>
      )}
    </>
  );
}

function EmailsPanel({ data, onChange }: PanelProps) {
  const [local, setLocal] = React.useState(data.emails);
  const save = async () => {
    const next = await updateSettings({ emails: local });
    onChange(next);
  };
  return (
    <PanelCard title="Email Notifications" onSave={save}>
      <h3 className="text-[13px] font-medium text-ink-2 uppercase tracking-wide mb-2">
        Notify me when
      </h3>
      <div className="flex flex-col gap-1 mb-5">
        <CheckRow
          checked={local.notifyAdmin.newBooking}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyAdmin: { ...local.notifyAdmin, newBooking: v },
            })
          }
          label="A new booking comes in"
        />
        <CheckRow
          checked={local.notifyAdmin.cancellation}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyAdmin: { ...local.notifyAdmin, cancellation: v },
            })
          }
          label="A booking is cancelled"
        />
        <CheckRow
          checked={local.notifyAdmin.reschedule}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyAdmin: { ...local.notifyAdmin, reschedule: v },
            })
          }
          label="A client requests a reschedule"
        />
      </div>

      <h3 className="text-[13px] font-medium text-ink-2 uppercase tracking-wide mb-2">
        Send clients
      </h3>
      <div className="flex flex-col gap-1 mb-5">
        <CheckRow
          checked={local.notifyClients.confirmation}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyClients: { ...local.notifyClients, confirmation: v },
            })
          }
          label="Confirmation email"
        />
        <CheckRow
          checked={local.notifyClients.reminder}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyClients: { ...local.notifyClients, reminder: v },
            })
          }
          label="Reminder email 24h before"
        />
        <CheckRow
          checked={local.notifyClients.followUp}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyClients: { ...local.notifyClients, followUp: v },
            })
          }
          label="Follow-up email after session"
        />
      </div>

      <Field label="From address">
        <Input
          value={local.fromAddress}
          onChange={(e) => setLocal({ ...local, fromAddress: e.target.value })}
        />
      </Field>
    </PanelCard>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer border transition-colors",
        checked ? "bg-accent-soft border-[rgba(61,90,61,0.2)]" : "bg-surface border-line-soft",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[color:var(--accent)]"
      />
      <span className="text-[14px] text-ink">{label}</span>
    </label>
  );
}

function AccountPanel({ data, onChange }: PanelProps) {
  const [local, setLocal] = React.useState(data.account);
  const save = async () => {
    const next = await updateSettings({ account: local });
    onChange(next);
  };
  return (
    <>
      <PanelCard title="Account" onSave={save}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Account email">
            <Input
              value={local.email}
              onChange={(e) => setLocal({ ...local, email: e.target.value })}
            />
          </Field>
          <Field label="Workspace name">
            <Input
              value={local.workspaceName}
              onChange={(e) => setLocal({ ...local, workspaceName: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-line-soft">
          <div>
            <div className="text-[14px] font-medium text-ink">Two-factor auth</div>
            <div className="text-small">
              {local.twoFactorEnabled ? "Enabled" : "Strongly recommended."}
            </div>
          </div>
          <Toggle
            checked={local.twoFactorEnabled}
            onChange={(v) => setLocal({ ...local, twoFactorEnabled: v })}
          />
        </div>
      </PanelCard>
      <Card padded>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="alert" size={14} className="text-danger" />
          <h3 className="text-[14px] font-medium text-danger">Danger zone</h3>
        </div>
        <p className="text-small mb-4">
          Deleting your workspace removes all bookings, clients and services. This cannot be undone.
        </p>
        <Button variant="danger" size="sm" icon="trash">
          Delete workspace
        </Button>
      </Card>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   LocationsCard — workspace's saved studios/offices.
   Used in Settings → Business Profile. Lets the operator name a place and
   fill its address once, then pick it from a dropdown when scheduling a
   session in SessionDrawer (so they don't retype the address every time).
   ────────────────────────────────────────────────────────────────────────── */

function LocationsCard({
  business,
  onChange,
}: {
  business: BusinessSettings;
  onChange: (next: BusinessSettings) => void;
}) {
  const { toast } = useToast();
  const locations = business.locations ?? [];
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<WorkspaceLocation | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pendingDelete, setPendingDelete] =
    React.useState<WorkspaceLocation | null>(null);

  const startNew = () => {
    setDraft({
      id: "",
      label: "",
      address: { ...EMPTY_ADDRESS },
    });
    setEditingId("__new__");
  };

  const startEdit = (loc: WorkspaceLocation) => {
    setDraft({ ...loc, address: { ...loc.address } });
    setEditingId(loc.id);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditingId(null);
  };

  const save = async () => {
    if (!draft) return;
    if (draft.label.trim().length === 0) {
      toast.error("Give the location a name.");
      return;
    }
    if (draft.address.street.trim().length === 0) {
      toast.error("Address line 1 is required.");
      return;
    }
    const exists = editingId !== "__new__";
    setBusy(true);
    try {
      const saved = exists
        ? await updateWorkspaceLocation(draft.id, {
            label: draft.label,
            address: draft.address,
          })
        : await createWorkspaceLocation({
            label: draft.label,
            address: draft.address,
          });
      const next = exists
        ? locations.map((location) => (location.id === saved.id ? saved : location))
        : [...locations, saved];
      onChange({ ...business, locations: next });
      toast.success(exists ? "Location updated" : "Location added");
      cancelEdit();
    } catch (error) {
      toast.error("Couldn't save location", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (loc: WorkspaceLocation) => {
    setBusy(true);
    try {
      await deleteWorkspaceLocation(loc.id);
      onChange({
        ...business,
        locations: locations.filter((location) => location.id !== loc.id),
      });
      toast.success("Location deleted");
      if (editingId === loc.id) cancelEdit();
      setPendingDelete(null);
    } catch (error) {
      toast.error("Couldn't delete location", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padded>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>
            Studios &amp; offices
          </h2>
          <p className="text-small mt-1">
            Save the places you regularly host sessions, then attach them to a
            session in one click.
          </p>
        </div>
        {!editingId && (
          <Button variant="secondary" size="sm" icon="plus" onClick={startNew}>
            Add location
          </Button>
        )}
      </div>

      {locations.length === 0 && !editingId && (
        <div className="rounded-md border border-dashed border-line bg-paper-2 px-4 py-5 text-small text-center">
          No saved locations yet. Add one to reuse it across sessions.
        </div>
      )}

      <div className="flex flex-col">
        {locations.map((loc) => {
          const editing = editingId === loc.id;
          if (editing && draft) {
            return (
              <LocationEditor
                key={loc.id}
                draft={draft}
                onChange={setDraft}
                onSave={save}
                onCancel={cancelEdit}
                busy={busy}
              />
            );
          }
          return (
            <div
              key={loc.id}
              className="flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0"
            >
              <span className="w-9 h-9 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center shrink-0">
                <Icon name="map-pin" size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-ink truncate">
                  {loc.label}
                </div>
                <div className="text-small truncate">
                  {formatAddressSummary(loc.address)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon="edit"
                onClick={() => startEdit(loc)}
                disabled={!!editingId}
              />
              <Button
                variant="ghost"
                size="sm"
                icon="trash"
                onClick={() => setPendingDelete(loc)}
                disabled={!!editingId}
              />
            </div>
          );
        })}

        {editingId === "__new__" && draft && (
          <LocationEditor
            draft={draft}
            onChange={setDraft}
            onSave={save}
            onCancel={cancelEdit}
            busy={busy}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => !busy && setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete);
        }}
        title={`Delete "${pendingDelete?.label ?? "this location"}"?`}
        description="Sessions that already use this location keep their address — only the saved entry is removed."
        confirmLabel="Delete location"
        destructive
        busy={busy}
      />
    </Card>
  );
}

function LocationEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  draft: WorkspaceLocation;
  onChange: (next: WorkspaceLocation) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-warm p-4 my-2 flex flex-col gap-4">
      <Field label="Location name" required>
        <Input
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder="e.g. Mitte Studio"
        />
      </Field>
      <AddressForm
        value={draft.address}
        onChange={(address) => onChange({ ...draft, address })}
        disabled={busy}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} loading={busy}>
          Save location
        </Button>
      </div>
    </div>
  );
}
