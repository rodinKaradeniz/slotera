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
import { getSettings, updateSettings } from "@/services/settings.service";
import { BillingPanel } from "./BillingPanel";
import type { SettingsData, WorkingDay } from "@/types/settings";
import { cn } from "@/lib/cn";

type SectionId =
  | "business"
  | "branding"
  | "payments"
  | "billing"
  | "calendar"
  | "emails"
  | "account";

const NAV: { id: SectionId; label: string; icon: IconName }[] = [
  { id: "business", label: "Business",          icon: "briefcase" },
  { id: "branding", label: "Branding",          icon: "sparkle" },
  { id: "payments", label: "Client payments",   icon: "card" },
  { id: "billing",  label: "Billing & subscription", icon: "wallet" },
  { id: "calendar", label: "Calendar",          icon: "calendar" },
  { id: "emails",   label: "Emails",            icon: "mail" },
  { id: "account",  label: "Account",           icon: "user" },
];

export function SettingsView() {
  const [section, setSection] = React.useState<SectionId>("business");
  const [data, setData] = React.useState<SettingsData | null>(null);

  React.useEffect(() => {
    getSettings().then(setData);
  }, []);

  const activeMeta = NAV.find((n) => n.id === section);
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
            {NAV.map((n) => {
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
              <div className="eyebrow mb-2">{activeMeta.label}</div>
              <h2
                className="font-serif text-ink"
                style={{ fontSize: 28, fontWeight: 380, letterSpacing: "-0.015em" }}
              >
                {activeMeta.label} settings
              </h2>
            </div>
          )}
          {!data ? (
            <LoadingRows count={2} />
          ) : (
            <div className="flex flex-col gap-6">
              {section === "business" && <BusinessPanel data={data} onChange={setData} />}
              {section === "branding" && <BrandingPanel data={data} onChange={setData} />}
              {section === "payments" && <PaymentsPanel data={data} onChange={setData} />}
              {section === "billing" && <BillingPanel />}
              {section === "calendar" && <CalendarPanel data={data} onChange={setData} />}
              {section === "emails" && <EmailsPanel data={data} onChange={setData} />}
              {section === "account" && <AccountPanel data={data} onChange={setData} />}
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

function BusinessPanel({ data, onChange }: PanelProps) {
  const [local, setLocal] = React.useState(data.business);
  const save = async () => {
    const next = await updateSettings({ business: local });
    onChange(next);
  };
  return (
    <PanelCard
      title="Business profile"
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
        <Field label="Booking page URL" className="sm:col-span-2">
          <Input
            value={local.bookingPageUrl}
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
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>Payment processors</h2>
          <p className="text-small mt-1">
            How your clients pay you. To manage how you pay Slotera, see{" "}
            <span className="text-ink-2">Billing &amp; subscription</span>.
          </p>
        </div>
        <div className="flex flex-col">
          {data.payments.processors.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0"
            >
              <span className="w-9 h-9 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
                <Icon
                  name={p.id === "paypal" ? "paypal" : "card"}
                  size={16}
                />
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
  const [enabled, setEnabled] = React.useState(data.payments.manualPaymentEnabled);
  const [instructions, setInstructions] = React.useState(
    data.payments.manualPaymentInstructions,
  );

  const save = async () => {
    const next = await updateSettings({
      payments: {
        ...data.payments,
        manualPaymentEnabled: enabled,
        manualPaymentInstructions: instructions,
      },
    });
    onChange(next);
  };

  const remove = async () => {
    setEnabled(false);
    setInstructions("");
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
      title="Manual payment"
      hint="Show clients custom payment instructions (bank transfer, Interac, etc.) at checkout. Bookings using manual payment stay pending until you confirm receipt."
      onSave={save}
    >
      <div className="flex items-center justify-between pb-4 border-b border-line-soft">
        <div>
          <div className="text-[14px] font-medium text-ink">
            Offer manual payment at checkout
          </div>
          <div className="text-small">
            Adds a &ldquo;Manual payment&rdquo; option to the public booking flow.
          </div>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      <Field
        label="Payment instructions"
        hint="Plain text. Shown to clients on the payment step and in confirmation emails."
        className="mt-4"
      >
        <Textarea
          value={instructions}
          rows={6}
          disabled={!enabled}
          placeholder={
            "Bank transfer to:\nYour Business\nIBAN: ...\nBIC: ...\n\nOr Interac e-Transfer to: you@example.com"
          }
          onChange={(e) => setInstructions(e.target.value)}
        />
      </Field>

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

function CalendarPanel({ data, onChange }: PanelProps) {
  const [hours, setHours] = React.useState<WorkingDay[]>(data.calendar.workingHours);
  const updateDay = (i: number, patch: Partial<WorkingDay>) =>
    setHours(hours.map((h, idx) => (i === idx ? { ...h, ...patch } : h)));
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
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>Calendar connections</h2>
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

      <PanelCard title="Working hours" onSave={save}>
        <div className="flex flex-col gap-2">
          {hours.map((h, i) => (
            <div
              key={h.day}
              className="grid grid-cols-[60px_auto_1fr_1fr] items-center gap-3 py-2"
            >
              <div className="text-[14px] font-medium text-ink">{h.day}</div>
              <Toggle
                checked={h.enabled}
                onChange={(v) => updateDay(i, { enabled: v })}
              />
              <Input
                type="time"
                value={h.start}
                disabled={!h.enabled}
                onChange={(e) => updateDay(i, { start: e.target.value })}
              />
              <Input
                type="time"
                value={h.end}
                disabled={!h.enabled}
                onChange={(e) => updateDay(i, { end: e.target.value })}
              />
            </div>
          ))}
        </div>
      </PanelCard>
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
    <PanelCard title="Email notifications" onSave={save}>
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
