"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { buildIcs, googleCalendarUrl, type CalendarEventInput } from "@/lib/ics";

type Props = {
  reference: string;
  serviceName: string;
  providerName: string;
  startISO: string;
  endISO: string;
  /** The meeting link when there is one, otherwise the place. */
  location?: string;
  meetingUrl?: string | null;
};

/**
 * "Add to calendar" on the confirmation and manage pages: an .ics download for Apple
 * Calendar, Outlook and most phones, and a prefilled Google Calendar link. The same UID
 * as the email attachment, so the two replace each other. No manage link inside.
 */
export function AddToCalendar(props: Props) {
  const { t } = useI18n();
  const event: CalendarEventInput = {
    reference: props.reference,
    startISO: props.startISO,
    endISO: props.endISO,
    title: t("booking.calendar.eventTitle", {
      service: props.serviceName,
      provider: props.providerName,
    }),
    location: props.meetingUrl || props.location || undefined,
    description: `${props.reference}\n${t("booking.calendar.note")}`,
    url: props.meetingUrl || undefined,
  };

  const download = () => {
    const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${props.reference.toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-micro">{t("booking.calendar.title")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon="calendar" onClick={download}>
          {t("booking.calendar.ics")}
        </Button>
        <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" iconRight="arrow-right">
            {t("booking.calendar.google")}
          </Button>
        </a>
      </div>
    </div>
  );
}
