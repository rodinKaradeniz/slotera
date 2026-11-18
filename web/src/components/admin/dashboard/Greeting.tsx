"use client";
import { readLang, localeForLang, translate } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { getSettings, updateSettings } from "@/services/settings.service";
import { cn } from "@/lib/cn";
import { dataSource } from "@/lib/env";
import type { SettingsData } from "@/types/settings";

type Props = {
  firstName?: string;
  subtitle?: string;
};

const WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];

export function spell(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

function timeGreeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return translate(readLang(), "dashboard.morning");
  if (h < 18) return translate(readLang(), "dashboard.afternoon");
  return translate(readLang(), "dashboard.evening");
}

export function Greeting({ firstName, subtitle }: Props) {
  const { t: uiText } = useI18n();
  const { openBookingDrawer } = useDrawers();
  const { toast } = useToast();

  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  // null = no decision in progress; boolean = the user is being asked to confirm
  // a transition to this target value.
  const [confirmTarget, setConfirmTarget] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (dataSource === "api") return;
    getSettings().then(setSettings);
  }, []);

  const enabled = settings?.business.bookingPageEnabled ?? true;

  const requestToggle = () => {
    if (!settings) return;
    setConfirmTarget(!enabled);
  };

  const confirm = async () => {
    if (!settings || confirmTarget === null) return;
    setBusy(true);
    try {
      const next = await updateSettings({
        business: { ...settings.business, bookingPageEnabled: confirmTarget },
      });
      setSettings(next);
      if (confirmTarget) {
        toast.success(uiText("ui.bookings.live"), {
          description: uiText("ui.your.public.page.is.accepting.bookings.again"),
        });
      } else {
        toast.info(uiText("ui.bookings.paused"), {
          description: uiText("ui.existing.bookings.are.unaffected"),
        });
      }
      setConfirmTarget(null);
    } catch (err) {
      toast.error(uiText("ui.couldn.t.update.booking.page"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const cancelConfirm = () => {
    if (busy) return;
    setConfirmTarget(null);
  };

  const date = new Date();
  const dateStr = date
    .toLocaleDateString(localeForLang(readLang()), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-10">
        <div>
          <div className="eyebrow mb-3">{dateStr}</div>
          <h1 className="text-h1 text-ink">
            {timeGreeting(date)}
            {firstName ? `, ${firstName}` : null}
            .
          </h1>
          {subtitle && (
            <p className="mt-3 text-small text-ink-3">{subtitle}</p>
          )}
        </div>
        {dataSource === "mock" && (
          <div className="flex flex-col gap-3 lg:items-end">
            <BookingPageToggleRow
              loading={settings === null}
              enabled={enabled}
              onRequestToggle={requestToggle}
            />
            <div className="flex flex-wrap items-center gap-2">
              <a href="/booking" target="_blank" rel="noreferrer">
                <Button
                  variant="secondary"
                  size="md"
                  icon="eye"
                  className="whitespace-nowrap"
                >
                  {uiText("ui.view.booking.page")}</Button>
              </a>
              <Button
                variant="primary"
                size="md"
                icon="plus"
                className="whitespace-nowrap"
                onClick={() => openBookingDrawer()}
              >
                {uiText("ui.new.booking")}</Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={confirmTarget !== null}
        onClose={cancelConfirm}
        title={
          confirmTarget === false ? uiText("ui.pause.bookings") : uiText("ui.resume.bookings")
        }
        description={
          confirmTarget === false
            ? uiText("ui.your.public.booking.page.will.show.a.currently.paused.notice.existing.bookings.stay.on.you")
            : uiText("ui.your.public.booking.page.will.start.accepting.new.bookings.again")
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={cancelConfirm} disabled={busy}>
              {uiText("ui.cancel")}</Button>
            <Button variant="primary" onClick={confirm} loading={busy}>
              {confirmTarget === false ? uiText("ui.pause.bookings") : uiText("ui.resume.bookings")}
            </Button>
          </>
        }
      />
    </>
  );
}

function BookingPageToggleRow({
  loading,
  enabled,
  onRequestToggle,
}: {
  loading: boolean;
  enabled: boolean;
  onRequestToggle: () => void;
}) {
  const { t: uiText } = useI18n();
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <Toggle
        checked={enabled}
        size="sm"
        disabled={loading}
        onChange={onRequestToggle}
        aria-label={enabled ? uiText("ui.pause.bookings") : uiText("ui.resume.bookings")}
      />
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors",
          enabled
            ? "bg-accent-soft text-accent"
            : "bg-paper-2 text-ink-3",
        )}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: enabled ? "var(--accent)" : "var(--ink-4)" }}
        />
        {loading ? uiText("ui.loading") : enabled ? uiText("ui.booking.page.live") : uiText("ui.bookings.paused")}
      </span>
    </div>
  );
}
