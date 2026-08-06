"use client";

import * as React from "react";
import Link from "next/link";
import { PublicNav } from "@/components/layout/PublicNav";
import { BookingFooter } from "@/components/layout/BookingFooter";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localeForLang } from "@/lib/i18n";
import { dataSource } from "@/lib/env";
import type { BookingDraft } from "@/components/booking/types";
import type { PublicBookingResult } from "@/services/public-booking.service";

type Stored = { ref: string; draft: BookingDraft; booking?: PublicBookingResult };

export default function ConfirmationPage() {
  const { t, lang } = useI18n();
  const locale = localeForLang(lang);
  const [data, setData] = React.useState<Stored | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("slotera.booking.last");
      if (raw) setData(JSON.parse(raw) as Stored);
    } catch {
      // ignore
    }
  }, []);

  const meetingLink = data ? `https://meet.slotera.app/${data.ref.toLowerCase()}` : "";
  const apiBooking = dataSource === "api" ? data?.booking : undefined;
  const isConfirmed = apiBooking?.status === "confirmed";

  const copy = async () => {
    if (!meetingLink) return;
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-[820px] mx-auto w-full px-6 pt-12 pb-12">
        <Card padded className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-5">
            <Icon name="check" size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-h2 text-ink">
            {apiBooking && !isConfirmed
              ? t("booking.confirm.pendingTitle")
              : t("booking.confirm.title")}
          </h1>
          <p className="text-body mt-2 text-ink-3">
            {apiBooking
              ? t("booking.confirm.emailQueued", {
                  email: data?.draft.customer.email ?? "",
                })
              : data?.draft.customer.email
                ? t("booking.confirm.emailSent", { email: data.draft.customer.email })
                : t("booking.confirm.emailSentNoAddress")}
          </p>
          {data && (
            <div className="mt-3">
              <Pill tone="accent" icon="sparkle">
                {t("booking.confirm.reference", { ref: data.ref })}
              </Pill>
            </div>
          )}
          {data && (
            <div className="grid sm:grid-cols-2 gap-3 mt-8 text-left">
              <DetailLine
                label={t("booking.confirm.service")}
                value={data.draft.service?.name ?? "—"}
              />
              <DetailLine
                label={t("booking.confirm.when")}
                value={
                  apiBooking
                    ? new Date(apiBooking.sessionStartAt).toLocaleString(locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZoneName: "short",
                      })
                    : data.draft.date
                    ? `${new Date(data.draft.date).toLocaleDateString(locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })} · ${data.draft.time}`
                    : "—"
                }
              />
              <DetailLine
                label={t("booking.confirm.attendee")}
                value={`${data.draft.customer.firstName} ${data.draft.customer.lastName}`.trim()}
              />
              {dataSource === "mock" && (
                <DetailLine label={t("booking.confirm.meetingLink")} value={meetingLink} />
              )}
            </div>
          )}
          {apiBooking?.pendingReasons.length ? (
            <div className="mt-5 rounded-md border border-line-soft bg-surface-warm px-4 py-3 text-small text-ink-2">
              {apiBooking.pendingReasons.includes("approval") &&
                t("booking.confirm.pendingApproval")}
              {apiBooking.pendingReasons.includes("approval") &&
                apiBooking.pendingReasons.includes("payment") && (
                  <span aria-hidden> · </span>
                )}
              {apiBooking.pendingReasons.includes("payment") &&
                t("booking.confirm.pendingPayment")}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {dataSource === "mock" && (
              <>
                <Button variant="primary" icon="copy" onClick={copy}>
                  {copied ? t("booking.confirm.copied") : t("booking.confirm.copyLink")}
                </Button>
                <Link href="/booking/manage/demo">
                  <Button variant="secondary" icon="eye">
                    {t("booking.confirm.manage")}
                  </Button>
                </Link>
              </>
            )}
            <Link href="/booking">
              <Button variant={dataSource === "api" ? "primary" : "ghost"}>
                {t("booking.confirm.bookAnother")}
              </Button>
            </Link>
          </div>
        </Card>

        {dataSource === "mock" && <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <NextCard
            icon="calendar"
            title={t("booking.confirm.addCalendar.title")}
            body={t("booking.confirm.addCalendar.body")}
          />
          <NextCard
            icon="download"
            title={t("booking.confirm.invoice.title")}
            body={t("booking.confirm.invoice.body")}
          />
          <NextCard
            icon="mail"
            title={t("booking.confirm.forward.title")}
            body={t("booking.confirm.forward.body")}
          />
        </div>}
      </main>
      <BookingFooter />
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 rounded-md bg-surface-warm border border-line-soft">
      <div className="text-micro">{label}</div>
      <div className="text-[14px] text-ink mt-0.5 break-all">{value}</div>
    </div>
  );
}

function NextCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <Card padded hover className="text-left">
      <div className="w-9 h-9 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center mb-3">
        <Icon name={icon} size={16} />
      </div>
      <div className="text-[14px] font-medium text-ink">{title}</div>
      <div className="text-small mt-0.5">{body}</div>
    </Card>
  );
}
