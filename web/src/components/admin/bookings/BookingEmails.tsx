"use client";
import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { listBookingEmails, sendBookingDetails } from "@/services/bookings.service";
import { BOOKING_EMAIL_STATUS } from "@/lib/status-maps";
import { validEmail } from "@/lib/client-validation";
import { localeForLang } from "@/lib/i18n";
import { dataSource } from "@/lib/env";
import type { Booking, BookingEmailPage } from "@/types/booking";

export function BookingEmails({ booking, fallbackEmail = "", onUpdated }: { booking: Booking; fallbackEmail?: string; onUpdated: (booking: Booking) => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [page, setPage] = React.useState<BookingEmailPage | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [reload, setReload] = React.useState(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [key, setKey] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [invalid, setInvalid] = React.useState(false);
  const sending = React.useRef(false);
  const emailInput = React.useRef<HTMLInputElement>(null);
  const current = booking.emailContact ?? booking.customer?.email ?? fallbackEmail;
  const corrected = email.trim().toLowerCase() !== current.trim().toLowerCase();
  React.useEffect(() => {
    let active = true;
    listBookingEmails(booking.id, offset).then((value) => { if (active) { setPage(value); setLoadError(null); } })
      .catch((err: Error) => { if (active) setLoadError(err.message); });
    return () => { active = false; };
  }, [booking.id, offset, reload]);
  const send = async () => {
    if (sending.current) return;
    if (!validEmail(email)) { setInvalid(true); emailInput.current?.focus(); return; }
    sending.current = true; setBusy(true); setError(null); setInvalid(false);
    try {
      const updated = await sendBookingDetails(booking.id, email.trim().toLowerCase(), key);
      onUpdated(updated); setOpen(false); setOffset(0); setReload((n) => n + 1);
      toast.success(t("booking.emails.queuedNotice"));
    } catch (err) { setError(err instanceof Error ? err.message : t("errors.unexpected")); }
    finally { sending.current = false; setBusy(false); }
  };
  const stamp = (value: string) => new Intl.DateTimeFormat(localeForLang(lang), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <Card className="p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-h3">{t("booking.emails.title")}</h2><div className="flex flex-wrap gap-2">
      <Button variant="ghost" onClick={() => setReload((n) => n + 1)}>{t("ui.refresh")}</Button>
      <Button variant="secondary" disabled={!current} onClick={() => { setEmail(current); setKey(crypto.randomUUID()); setError(null); setInvalid(false); setOpen(true); }}>{t("booking.emails.send")}</Button>
    </div></div>
    <p className="text-small text-ink-3">{t("booking.emails.accepted")}</p>
    {dataSource === "mock" && <p className="text-small text-ink-3">{t("booking.emails.local")}</p>}
    {!current && <p>{t("booking.emails.erased")}</p>}
    {loadError ? <div role="alert">{loadError}<Button variant="ghost" onClick={() => setReload((n) => n + 1)}>{t("forms.retry")}</Button></div> : !page ? <p>{t("ui.loading")}</p> : !page.items.length ? <p className="text-ink-3">{t("booking.emails.empty")}</p> : <ul className="divide-y divide-line-soft">{page.items.map((item) => {
      const meta = BOOKING_EMAIL_STATUS[item.status];
      return <li key={item.id} className="py-4 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{t(`booking.emails.${item.kind}`)}</p><Pill tone={meta.tone}>{t(meta.label)}</Pill></div>
        <p className="text-small break-all">{item.recipientEmail}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-small text-ink-3"><span>{t("booking.emails.created")}: {stamp(item.createdAt)}</span>
          {item.sentAt && <span>{t("booking.emails.sentAt")}: {stamp(item.sentAt)}</span>}
          {item.status === "retrying" && <span>{t("booking.emails.nextAttempt")}: {stamp(item.availableAt)}</span>}
          <span>{t("booking.emails.attempts", { count: item.attemptCount })}</span>
          {item.simulated && <span>{t("booking.emails.local")}</span>}
        </div>
      </li>;
    })}</ul>}
    {page && page.total > 20 && <div className="flex gap-2"><Button variant="ghost" disabled={!offset} onClick={() => setOffset((n) => Math.max(0, n - 20))}>{t("booking.emails.previous")}</Button><Button variant="ghost" disabled={offset + 20 >= page.total} onClick={() => setOffset((n) => n + 20)}>{t("booking.emails.next")}</Button></div>}
    <ConfirmDialog open={open} busy={busy} onClose={() => !busy && setOpen(false)} onConfirm={send} title={t(corrected ? "booking.emails.correct" : "booking.emails.send")} confirmLabel={t(corrected ? "booking.emails.correct" : "booking.emails.send")}
      description={<div className="space-y-4"><p>{t("booking.emails.review")}</p>
        <Field label={t("booking.emails.destination")} required error={invalid ? t("booking.create.emailInvalid") : undefined}>
          <Input ref={emailInput} type="email" value={email} disabled={busy} maxLength={320} aria-invalid={invalid} onChange={(e) => setEmail(e.target.value)} />
        </Field><p>{t("booking.emails.correction")}</p>{error && <p role="alert" className="text-danger">{error}</p>}
      </div>} />
  </Card>;
}
