"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { updateBusinessSettings, updateSettings, type BusinessSettings } from "@/services/settings.service";
import { PanelProps, PanelCard, CheckRow } from "./PanelCard";

export function ApiEmailsPanel({
  business,
  onChange,
}: {
  business: BusinessSettings;
  onChange: (next: BusinessSettings) => void;
}) {
  const [local, setLocal] = React.useState(
    business.notifyOperator ?? { newBooking: true, cancelled: true, rescheduled: true },
  );
  const save = async () => {
    onChange(await updateBusinessSettings({ notifyOperator: local }));
  };
  return (
    <PanelCard
      title="Email Notifications"
      hint="Emails to your business address when a client acts on their own. Clients always get their booking emails."
      onSave={save}
    >
      <h3 className="text-[13px] font-medium text-ink-2 uppercase tracking-wide mb-2">
        Notify me when
      </h3>
      <div className="flex flex-col gap-1">
        <CheckRow
          checked={local.newBooking}
          onChange={(v) => setLocal({ ...local, newBooking: v })}
          label="A new booking comes in"
        />
        <CheckRow
          checked={local.cancelled}
          onChange={(v) => setLocal({ ...local, cancelled: v })}
          label="A client cancels a booking"
        />
        <CheckRow
          checked={local.rescheduled}
          onChange={(v) => setLocal({ ...local, rescheduled: v })}
          label="A client moves a booking"
        />
      </div>
    </PanelCard>
  );
}

export function EmailsPanel({ data, onChange }: PanelProps) {
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
