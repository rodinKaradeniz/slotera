"use client";

import * as React from "react";
import Link from "next/link";
import { PublicNav } from "@/components/layout/PublicNav";
import { BookingFooter } from "@/components/layout/BookingFooter";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localeForLang } from "@/lib/i18n";
import type { Messages } from "@/i18n/messages/en";

/**
 * Mocked, public, no-auth preview of the future customer reservation page.
 * Demonstrates what a client could do after booking — review details, complete
 * optional (post-payment) forms, message the provider, and request a reschedule
 * / cancellation. Everything here is mocked: no IDs, tokens, persistence, or
 * email. See CLAUDE.md → "Customer reservation page (demo)".
 */

// A fixed demo reservation. Provider/service names stay as mock data; the UI
// chrome around them is translated.
const DEMO = {
  provider: "Dr. Lena Hartmann",
  service: "Strategy deep-dive",
  // 14 days out at 14:00 local, so the page always shows an upcoming booking.
  dateISO: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(14, 0, 0, 0);
    return d.toISOString();
  })(),
  reference: "SLT-DEMO1",
  manualInstructions:
    "Bank transfer to: Velora Labs · IBAN GB00 SLOT 0000 0000 0000 00 · Reference SLT-DEMO1",
};

type OptionalForm = {
  id: string;
  nameKey: keyof Messages;
  descKey: keyof Messages;
  fieldKey: keyof Messages;
  placeholderKey?: keyof Messages;
};

const OPTIONAL_FORMS: OptionalForm[] = [
  {
    id: "notes",
    nameKey: "reservation.form.notes.name",
    descKey: "reservation.form.notes.desc",
    fieldKey: "reservation.form.notes.field",
    placeholderKey: "reservation.form.notes.placeholder",
  },
  {
    id: "update",
    nameKey: "reservation.form.update.name",
    descKey: "reservation.form.update.desc",
    fieldKey: "reservation.form.update.field",
  },
];

export default function ReservationDemoPage() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const locale = localeForLang(lang);

  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [completed, setCompleted] = React.useState<Record<string, boolean>>({});
  const [message, setMessage] = React.useState("");
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const formsRef = React.useRef<HTMLDivElement>(null);
  const messageRef = React.useRef<HTMLTextAreaElement>(null);

  const whenLabel = new Date(DEMO.dateISO).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLabel = new Date(DEMO.dateISO).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const saveForm = (id: string) => {
    setCompleted((c) => ({ ...c, [id]: true }));
    toast.success(t("reservation.forms.saved"), {
      description: t("reservation.forms.savedDesc"),
    });
  };

  const sendMessage = () => {
    if (message.trim().length === 0) return;
    setMessage("");
    toast.success(t("reservation.message.sent"), {
      description: t("reservation.message.sentDesc"),
    });
  };

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (ref === messageRef) messageRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-[920px] mx-auto w-full px-6 pt-10 pb-12">
        <div className="flex flex-col gap-2 mb-8">
          <div>
            <Pill tone="neutral" icon="info">
              {t("reservation.badge")}
            </Pill>
          </div>
          <h1
            className="font-serif text-ink"
            style={{
              fontSize: 32,
              fontWeight: 380,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
            }}
          >
            {t("reservation.title")}
          </h1>
          <p className="text-body text-ink-3 max-w-2xl">
            {t("reservation.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          {/* Summary */}
          <section className="flex flex-col gap-4">
            <Card padded>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-h3">{t("reservation.summary.title")}</h2>
                <Pill tone="success" icon="check">
                  {t("reservation.status.confirmed")}
                </Pill>
              </div>
              <dl className="flex flex-col gap-3">
                <SummaryItem
                  icon="briefcase"
                  label={t("reservation.summary.service")}
                  value={DEMO.service}
                />
                <SummaryItem
                  icon="user"
                  label={t("reservation.summary.provider")}
                  value={DEMO.provider}
                />
                <SummaryItem
                  icon="calendar"
                  label={t("reservation.summary.when")}
                  value={`${whenLabel} · ${timeLabel}`}
                />
                <SummaryItem
                  icon="video"
                  label={t("reservation.summary.location")}
                  value={t("reservation.location.online")}
                />
                <SummaryItem
                  icon="wallet"
                  label={t("reservation.summary.payment")}
                  value={t("reservation.payment.manualLabel")}
                />
                <SummaryItem
                  icon="clipboard"
                  label={t("reservation.summary.reference")}
                  value={DEMO.reference}
                />
              </dl>

              <div className="mt-4 rounded-md bg-paper-2 border border-line-soft px-3 py-3">
                <div className="eyebrow mb-1.5">
                  {t("reservation.payment.instructionsLabel")}
                </div>
                <p className="text-small whitespace-pre-line text-ink">
                  {DEMO.manualInstructions}
                </p>
              </div>
            </Card>
          </section>

          {/* Actions */}
          <section>
            <Card padded>
              <h2 className="text-h3 mb-4">{t("reservation.actions.title")}</h2>
              <div className="flex flex-col gap-2">
                <ActionRow
                  icon="clipboard"
                  label={t("reservation.actions.formsLabel")}
                  hint={t("reservation.actions.formsHint")}
                  onClick={() => scrollTo(formsRef)}
                />
                <ActionRow
                  icon="mail"
                  label={t("reservation.actions.messageLabel")}
                  hint={t("reservation.actions.messageHint")}
                  onClick={() => scrollTo(messageRef)}
                />
                <ActionRow
                  icon="clock"
                  label={t("reservation.actions.rescheduleLabel")}
                  hint={t("reservation.actions.rescheduleHint")}
                  onClick={() => setRescheduleOpen(true)}
                />
                <ActionRow
                  icon="x"
                  label={t("reservation.actions.cancelLabel")}
                  hint={t("reservation.actions.cancelHint")}
                  onClick={() => setCancelOpen(true)}
                />
              </div>
            </Card>
          </section>
        </div>

        {/* Optional forms */}
        <section ref={formsRef} className="mt-6 scroll-mt-24">
          <Card padded>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-h3">{t("reservation.forms.title")}</h2>
            </div>
            <p className="text-small mb-5">{t("reservation.forms.note")}</p>
            <div className="flex flex-col gap-5">
              {OPTIONAL_FORMS.map((form) => (
                <div
                  key={form.id}
                  className="rounded-md border border-line-soft bg-surface-warm p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3
                        className="font-serif text-ink"
                        style={{ fontSize: 18, fontWeight: 400 }}
                      >
                        {t(form.nameKey)}
                      </h3>
                      <p className="text-small mt-1">{t(form.descKey)}</p>
                    </div>
                    <Pill tone={completed[form.id] ? "success" : "neutral"}>
                      {completed[form.id]
                        ? t("reservation.forms.completedBadge")
                        : t("reservation.forms.optionalBadge")}
                    </Pill>
                  </div>
                  <div className="mt-4">
                    <Field label={t(form.fieldKey)} optional>
                      <Textarea
                        rows={3}
                        value={formValues[form.id] ?? ""}
                        placeholder={
                          form.placeholderKey ? t(form.placeholderKey) : undefined
                        }
                        onChange={(e) =>
                          setFormValues((v) => ({ ...v, [form.id]: e.target.value }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="check"
                      onClick={() => saveForm(form.id)}
                      disabled={(formValues[form.id] ?? "").trim().length === 0}
                    >
                      {t("reservation.forms.save")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Message provider */}
        <section className="mt-6">
          <Card padded>
            <h2 className="text-h3 mb-4">{t("reservation.message.title")}</h2>
            <Textarea
              ref={messageRef}
              rows={4}
              value={message}
              placeholder={t("reservation.message.placeholder")}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <Button
                variant="primary"
                size="md"
                icon="mail"
                onClick={sendMessage}
                disabled={message.trim().length === 0}
              >
                {t("reservation.message.send")}
              </Button>
            </div>
          </Card>
        </section>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-micro max-w-xl">{t("reservation.disclaimer")}</p>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/booking">
              <Button variant="ghost" size="sm" icon="arrow-left">
                {t("reservation.back")}
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                {t("reservation.backHome")}
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <BookingFooter />

      <ConfirmDialog
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onConfirm={() => {
          setRescheduleOpen(false);
          toast.info(t("reservation.reschedule.sent"), {
            description: t("reservation.reschedule.sentDesc"),
          });
        }}
        title={t("reservation.reschedule.title")}
        description={t("reservation.reschedule.body")}
        confirmLabel={t("reservation.reschedule.confirm")}
        cancelLabel={t("common.cancel")}
      />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          toast.info(t("reservation.cancel.sent"), {
            description: t("reservation.cancel.sentDesc"),
          });
        }}
        title={t("reservation.cancel.title")}
        description={t("reservation.cancel.body")}
        confirmLabel={t("reservation.cancel.confirm")}
        cancelLabel={t("common.cancel")}
        destructive
      />
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 h-8 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center shrink-0">
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0">
        <dt className="text-micro">{label}</dt>
        <dd className="text-[14px] text-ink mt-0.5">{value}</dd>
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-md border border-line-soft bg-surface px-4 py-3 text-left hover:border-ink-3 transition-colors"
    >
      <span className="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
        <Icon name={icon} size={15} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        <span className="block text-small">{hint}</span>
      </span>
      <Icon name="chevron-r" size={16} className="text-ink-4 shrink-0" />
    </button>
  );
}
