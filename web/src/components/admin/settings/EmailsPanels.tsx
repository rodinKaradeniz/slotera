"use client";
import { useSettingsEdit } from "@/components/shared/use-settings-edit";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { getBusinessSettings, updateBusinessSettings, updateSettings, type BusinessSettings } from "@/services/settings.service";
import { PanelProps, PanelCard, CheckRow } from "./PanelCard";

export function ApiEmailsPanel({
  business,
  onChange,
}: {
  business: BusinessSettings;
  onChange: (next: BusinessSettings) => void;
}) {
  const { t: uiText } = useI18n();
  const [local, setLocal] = React.useState(
    business.notifyOperator ?? { newBooking: true, cancelled: true, rescheduled: true },
  );
  const edit = useSettingsEdit(business, getBusinessSettings, (next) => {
    setLocal(next.notifyOperator ?? {newBooking: true, cancelled: true, rescheduled: true}); onChange(next);
  });
  const save = async () => {
    try {
      const next = await updateBusinessSettings({ notifyOperator: local, version: edit.version });
      edit.accept({...next, id: "settings"}); onChange(next);
    } catch (error) {edit.onError(error); throw error;}
  };
  return (
    <PanelCard
      title={uiText("ui.email.notifications")}
      hint={uiText("ui.emails.to.your.business.address.when.a.client.acts.on.their.own.clients.always.get.their.b")}
      onSave={save}
    >
      {edit.notice}
      <h3 className="text-[13px] font-medium text-ink-2 uppercase tracking-wide mb-2">
        {uiText("ui.notify.me.when")}</h3>
      <div className="flex flex-col gap-1">
        <CheckRow
          checked={local.newBooking}
          onChange={(v) => setLocal({ ...local, newBooking: v })}
          label={uiText("ui.a.new.booking.comes.in")}
        />
        <CheckRow
          checked={local.cancelled}
          onChange={(v) => setLocal({ ...local, cancelled: v })}
          label={uiText("ui.a.client.cancels.a.booking")}
        />
        <CheckRow
          checked={local.rescheduled}
          onChange={(v) => setLocal({ ...local, rescheduled: v })}
          label={uiText("ui.a.client.moves.a.booking")}
        />
      </div>
    </PanelCard>
  );
}

export function EmailsPanel({ data, onChange }: PanelProps) {
  const { t: uiText } = useI18n();
  const [local, setLocal] = React.useState(data.emails);
  const save = async () => {
    const next = await updateSettings({ emails: local });
    onChange(next);
  };
  return (
    <PanelCard title={uiText("ui.email.notifications")} onSave={save}>
      <h3 className="text-[13px] font-medium text-ink-2 uppercase tracking-wide mb-2">
        {uiText("ui.notify.me.when")}</h3>
      <div className="flex flex-col gap-1 mb-5">
        <CheckRow
          checked={local.notifyAdmin.newBooking}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyAdmin: { ...local.notifyAdmin, newBooking: v },
            })
          }
          label={uiText("ui.a.new.booking.comes.in")}
        />
        <CheckRow
          checked={local.notifyAdmin.cancellation}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyAdmin: { ...local.notifyAdmin, cancellation: v },
            })
          }
          label={uiText("ui.a.booking.is.cancelled")}
        />
        <CheckRow
          checked={local.notifyAdmin.reschedule}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyAdmin: { ...local.notifyAdmin, reschedule: v },
            })
          }
          label={uiText("ui.a.client.requests.a.reschedule")}
        />
      </div>

      <h3 className="text-[13px] font-medium text-ink-2 uppercase tracking-wide mb-2">
        {uiText("ui.send.clients")}</h3>
      <div className="flex flex-col gap-1 mb-5">
        <CheckRow
          checked={local.notifyClients.confirmation}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyClients: { ...local.notifyClients, confirmation: v },
            })
          }
          label={uiText("ui.confirmation.email")}
        />
        <CheckRow
          checked={local.notifyClients.reminder}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyClients: { ...local.notifyClients, reminder: v },
            })
          }
          label={uiText("ui.reminder.email.24h.before")}
        />
        <CheckRow
          checked={local.notifyClients.followUp}
          onChange={(v) =>
            setLocal({
              ...local,
              notifyClients: { ...local.notifyClients, followUp: v },
            })
          }
          label={uiText("ui.follow.up.email.after.session")}
        />
      </div>

      <Field label={uiText("ui.from.address")}>
        <Input
          value={local.fromAddress}
          onChange={(e) => setLocal({ ...local, fromAddress: e.target.value })}
        />
      </Field>
    </PanelCard>
  );
}
