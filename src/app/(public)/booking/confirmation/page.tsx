"use client";

import * as React from "react";
import Link from "next/link";
import { BookingTopBar } from "@/components/layout/BookingTopBar";
import { BookingFooter } from "@/components/layout/BookingFooter";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import type { BookingDraft } from "@/components/booking/types";

type Stored = { ref: string; draft: BookingDraft };

export default function ConfirmationPage() {
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
      <BookingTopBar />
      <main className="flex-1 max-w-[820px] mx-auto w-full px-6 pt-12 pb-12">
        <Card padded className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-5">
            <Icon name="check" size={28} strokeWidth={2.5} />
          </div>
          <h1 className="h-2">Your booking is confirmed.</h1>
          <p className="text-body mt-2 text-ink-3">
            We&apos;ve sent a confirmation email
            {data?.draft.customer.email ? ` to ${data.draft.customer.email}` : ""}.
          </p>
          {data && (
            <div className="mt-3">
              <Pill tone="accent" icon="sparkle">
                Reference {data.ref}
              </Pill>
            </div>
          )}
          {data && (
            <div className="grid sm:grid-cols-2 gap-3 mt-8 text-left">
              <DetailLine label="Service" value={data.draft.service?.name ?? "—"} />
              <DetailLine
                label="When"
                value={
                  data.draft.date
                    ? `${new Date(data.draft.date).toLocaleDateString(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })} · ${data.draft.time}`
                    : "—"
                }
              />
              <DetailLine
                label="Attendee"
                value={`${data.draft.customer.firstName} ${data.draft.customer.lastName}`.trim()}
              />
              <DetailLine label="Meeting link" value={meetingLink} />
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <Button variant="primary" icon="copy" onClick={copy}>
              {copied ? "Copied" : "Copy meeting link"}
            </Button>
            <Link href="/booking">
              <Button variant="secondary">Book another session</Button>
            </Link>
          </div>
        </Card>

        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <NextCard icon="calendar" title="Add to calendar" body="Google · Apple · Outlook · ICS" />
          <NextCard icon="download" title="Download invoice" body="PDF, billing-ready" />
          <NextCard icon="mail" title="Forward email" body="Loop in a colleague" />
        </div>
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
