"use client";
import { readLang, localeForLang } from "@/lib/i18n";
import { useSettingsEdit } from "@/components/shared/use-settings-edit";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { WorkingHoursForm } from "@/components/shared/forms/WorkingHoursForm";
import { useToast } from "@/components/ui/Toast";
import { getAvailabilitySettings, updateAvailabilitySettings, availabilityToWorkingDays, workingDaysToWeeklyHours, updateSettings, type AvailabilitySettings } from "@/services/settings.service";
import { CalendarFeedCard } from "./CalendarFeedCard";
import type { WorkingDay } from "@/types/settings";
import { PanelProps, PanelCard } from "./PanelCard";

export function BookingTermsPanel({ data, onChange }: PanelProps) {
  const { t: uiText } = useI18n();
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
      title={uiText("ui.booking.terms")}
      hint={uiText("ui.your.own.booking.terms.shown.to.clients.during.checkout.separate.from.slotera.s.platform.t")}
      onSave={save}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-4 border-b border-line-soft">
          <div>
            <div className="text-[14px] font-medium text-ink">
              {uiText("ui.enable.custom.booking.terms")}</div>
            <div className="text-small">
              {uiText("ui.shown.to.clients.on.the.booking.page.when.they.open.the.terms.and.privacy.modal")}</div>
          </div>
          <Toggle
            checked={value.enabled}
            onChange={(enabled) => setValue({ ...value, enabled })}
          />
        </div>
        <Field
          label={uiText("ui.terms.content")}
          hint={uiText("ui.plain.text.cancellation.window.refund.policy.no.show.rules.etc")}
        >
          <Textarea
            value={value.content}
            rows={8}
            disabled={!value.enabled}
            placeholder={uiText("ui.cancellations.and.rescheduling.are.free.up.to.24.hours.before.your.session")}
            onChange={(e) => setValue({ ...value, content: e.target.value })}
          />
        </Field>
      </div>
    </PanelCard>
  );
}

export function CalendarPanel({ data, onChange }: PanelProps) {
  const { t: uiText } = useI18n();
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
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>{uiText("ui.calendar.connections")}</h2>
          <p className="text-small mt-1">{uiText("ui.two.way.sync.prevents.double.booking")}</p>
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
              {c.status === "connected" ? uiText("ui.connected") : uiText("ui.not.connected")}
            </Pill>
            <Button variant="secondary" size="sm">
              {c.status === "connected" ? uiText("ui.manage") : uiText("ui.connect")}
            </Button>
          </div>
        ))}
      </Card>

      <PanelCard title={uiText("ui.working.hours")} onSave={save}>
        <WorkingHoursForm value={hours} onChange={setHours} />
      </PanelCard>
    </>
  );
}

export function ApiCalendarPanel({
  availability,
  onChange,
}: {
  availability: AvailabilitySettings;
  onChange: (next: AvailabilitySettings) => void;
}) {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [local, setLocal] = React.useState(availability);

  const [hours, setHours] = React.useState<WorkingDay[]>(() =>
    availabilityToWorkingDays(availability),
  );
  const edit = useSettingsEdit(local, getAvailabilitySettings, (next) => {setLocal(next); onChange(next);setHours(availabilityToWorkingDays(next));});
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const weeklyHours = workingDaysToWeeklyHours(hours);
    setSaving(true);
    try {
      const next = await updateAvailabilitySettings({ ...local, weeklyHours });
      edit.accept({...next, id: "settings"});
      setLocal(next);
      setHours(availabilityToWorkingDays(next));
      onChange(next);
      toast.success(uiText("ui.calendar.settings.saved"));
    } catch (error) {
      edit.onError(error);
      toast.error(uiText("ui.couldn.t.save.calendar.settings"), {
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
      | "maximumAdvanceDays"
      | "customerChangeNoticeHours",
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setLocal({ ...local, [key]: Number.isFinite(value) ? value : 0 });
  };

  return (
    <>
      {edit.notice}
      <CalendarFeedCard />

      <Card padded>
        <div className="mb-4">
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>{uiText("ui.availability")}</h2>
          <p className="text-small mt-1">
            {uiText("ui.these.workspace.wide.rules.shape.future.public.availability.they.do.not.create.bookings.or")}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <Field label={uiText("ui.workspace.timezone")}>
            <Input
              value={local.timezone}
              onChange={(event) => setLocal({ ...local, timezone: event.target.value })}
              placeholder="Europe/Berlin"
            />
          </Field>
          <Field label={uiText("ui.slot.interval.min")}>
            <Input type="number" min={5} value={String(local.slotIntervalMin)} onChange={numericField("slotIntervalMin")} />
          </Field>
          <Field label={uiText("ui.buffer.before.min")}>
            <Input type="number" min={0} value={String(local.bufferBeforeMin)} onChange={numericField("bufferBeforeMin")} />
          </Field>
          <Field label={uiText("ui.buffer.after.min")}>
            <Input type="number" min={0} value={String(local.bufferAfterMin)} onChange={numericField("bufferAfterMin")} />
          </Field>
          <Field label={uiText("ui.minimum.notice.min")}>
            <Input type="number" min={0} value={String(local.minimumNoticeMin)} onChange={numericField("minimumNoticeMin")} />
          </Field>
          <Field label={uiText("ui.maximum.advance.days")}>
            <Input type="number" min={1} value={String(local.maximumAdvanceDays)} onChange={numericField("maximumAdvanceDays")} />
          </Field>
          <Field
            label={uiText("ui.client.changes.allowed.until.hours.before")}
            hint={uiText("ui.clients.can.cancel.or.move.a.booking.themselves.from.their.email.link.until.then")}
          >
            <Input type="number" min={0} max={720} value={String(local.customerChangeNoticeHours)} onChange={numericField("customerChangeNoticeHours")} />
          </Field>
        </div>
        <div className="border-t border-line-soft pt-5">
          <h3 className="text-[13px] font-medium text-ink mb-2">{uiText("ui.working.hours")}</h3>
          <WorkingHoursForm value={hours} onChange={setHours} disabled={saving} />
        </div>
        <div className="flex justify-end mt-5 pt-4 border-t border-line-soft">
          <Button variant="primary" onClick={save} loading={saving}>{uiText("ui.save.availability")}</Button>
        </div>
      </Card>

      {local.blackouts.length > 0 && (
        <PanelCard
          title={uiText("ui.blackout.dates")}
          hint={uiText("ui.existing.blackout.ranges.are.preserved.when.availability.is.saved")}
        >
          <div className="flex flex-col gap-2">
            {local.blackouts.map((blackout) => (
              <div key={blackout.id ?? `${blackout.startsAt}-${blackout.endsAt}`} className="text-small text-ink-2">
                {new Intl.DateTimeFormat(localeForLang(readLang()), { dateStyle: "medium", timeStyle: "short" }).format(new Date(blackout.startsAt))}
                {" – "}
                {new Intl.DateTimeFormat(localeForLang(readLang()), { dateStyle: "medium", timeStyle: "short" }).format(new Date(blackout.endsAt))}
                {blackout.reason ? ` · ${blackout.reason}` : ""}
              </div>
            ))}
          </div>
        </PanelCard>
      )}
    </>
  );
}
