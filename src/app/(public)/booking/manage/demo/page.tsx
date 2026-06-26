"use client";

import * as React from "react";
import Link from "next/link";
import { PublicNav } from "@/components/layout/PublicNav";
import { BookingFooter } from "@/components/layout/BookingFooter";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localeForLang } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { Messages } from "@/i18n/messages/en";

/**
 * Mocked, public, no-auth preview of the customer booking workspace.
 *
 * Layout: a compact header, then a two-column workspace — a wide left content
 * area showing the selected tab, and a quiet vertical tab menu on the right
 * (separated by a subtle vertical line). Tabs: Booking info, Manage booking,
 * Forms, Payment, and Package (only when the booking is part of a package).
 *
 * Everything here is mocked: no IDs, tokens, persistence, or email. Internal
 * admin session notes / action items are never exposed here. A production
 * version would open from a secure booking link sent by email and persist on a
 * backend. See CLAUDE.md → "Customer booking workspace (demo)".
 */

const DEMO = {
  provider: "Dr. Lena Hartmann",
  service: "Strategy Session",
  // 14 days out at 14:00 local, so the page always shows an upcoming booking.
  dateISO: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(14, 0, 0, 0);
    return d.toISOString();
  })(),
  reference: "SLT-DEMO1",
  currency: "GBP",
  // Manual (unpaid) booking — drives the Payment tab.
  amountCents: 12000,
  taxCents: 0,
  manualInstructions:
    "Bank transfer to: Velora Labs · IBAN GB00 SLOT 0000 0000 0000 00 · Reference SLT-DEMO1",
  // Display-only package context — no credit ledger, balance, or checkout.
  package: {
    name: "Strategy Sprint Package",
    sessionIndex: 2,
    sessionTotal: 3,
    items: ["Discovery Call", "Strategy Session", "Coaching Session"],
  },
};

type DemoForm = {
  id: string;
  required: boolean;
  nameKey: keyof Messages;
  descKey: keyof Messages;
  fieldKey: keyof Messages;
  placeholderKey?: keyof Messages;
  /** Read-only answer shown for a form completed before payment. */
  answerKey?: keyof Messages;
};

const FORMS: DemoForm[] = [
  {
    id: "intake",
    required: true,
    nameKey: "bookingManage.form.intake.name",
    descKey: "bookingManage.form.intake.desc",
    fieldKey: "bookingManage.form.intake.field",
    answerKey: "bookingManage.form.intake.answer",
  },
  {
    id: "notes",
    required: false,
    nameKey: "bookingManage.form.notes.name",
    descKey: "bookingManage.form.notes.desc",
    fieldKey: "bookingManage.form.notes.field",
    placeholderKey: "bookingManage.form.notes.placeholder",
  },
  {
    id: "update",
    required: false,
    nameKey: "bookingManage.form.update.name",
    descKey: "bookingManage.form.update.desc",
    fieldKey: "bookingManage.form.update.field",
  },
];

type TabId = "info" | "manage" | "forms" | "payment" | "package";

export default function BookingManageDemoPage() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const locale = localeForLang(lang);

  const [tab, setTab] = React.useState<TabId>("info");
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  // The required intake form was completed before payment.
  const [completed, setCompleted] = React.useState<Record<string, boolean>>({
    intake: true,
  });
  const [openFormId, setOpenFormId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const hasPackage = !!DEMO.package;

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

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: DEMO.currency,
    }).format(cents / 100);

  const pendingForms = FORMS.filter((f) => !completed[f.id]).length;
  const contextLine =
    pendingForms === 0
      ? t("bookingManage.info.context.none")
      : pendingForms === 1
        ? t("bookingManage.info.context.one")
        : t("bookingManage.info.context.many", { n: pendingForms });

  const saveForm = (id: string) => {
    setCompleted((c) => ({ ...c, [id]: true }));
    setOpenFormId(null);
    toast.success(t("bookingManage.forms.saved"), {
      description: t("bookingManage.forms.savedDesc"),
    });
  };

  const sendMessage = () => {
    if (message.trim().length === 0) return;
    setMessage("");
    toast.success(t("bookingManage.message.sent"), {
      description: t("bookingManage.message.sentDesc"),
    });
  };

  const TABS: { id: TabId; icon: IconName; label: string; count?: number }[] = [
    { id: "info", icon: "info", label: t("bookingManage.tab.info") },
    { id: "manage", icon: "mail", label: t("bookingManage.tab.manage") },
    {
      id: "forms",
      icon: "clipboard",
      label: t("bookingManage.tab.forms"),
      count: pendingForms || undefined,
    },
    { id: "payment", icon: "wallet", label: t("bookingManage.tab.payment") },
    ...(hasPackage
      ? [
          {
            id: "package" as const,
            icon: "layers" as IconName,
            label: t("bookingManage.tab.package"),
          },
        ]
      : []),
  ];

  const openForm = openFormId ? FORMS.find((f) => f.id === openFormId) : null;
  const openFormReadOnly = !!openForm && openForm.required && !!completed[openForm.id];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-[1080px] mx-auto w-full px-6 pt-10 pb-12">
        <div className="flex flex-col gap-2 mb-6">
          <div>
            <Pill tone="neutral" icon="info">
              {t("bookingManage.badge")}
            </Pill>
          </div>
          <h1
            className="font-serif text-ink"
            style={{
              fontSize: 30,
              fontWeight: 380,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
            }}
          >
            {t("bookingManage.title")}
          </h1>
          <p className="text-body text-ink-3 max-w-2xl">
            {t("bookingManage.subtitle")}
          </p>
        </div>

        <Card padded>
          <div className="grid gap-6 lg:grid-cols-[1fr_236px]">
            {/* Left / selected tab content */}
            <div className="order-2 lg:order-1 min-w-0">
              {tab === "info" && (
                <BookingInfo
                  t={t}
                  whenLabel={whenLabel}
                  timeLabel={timeLabel}
                  contextLine={contextLine}
                  allDone={pendingForms === 0}
                />
              )}

              {tab === "manage" && (
                <ManageBooking
                  t={t}
                  message={message}
                  setMessage={setMessage}
                  onSend={sendMessage}
                  onReschedule={() => setRescheduleOpen(true)}
                  onCancel={() => setCancelOpen(true)}
                />
              )}

              {tab === "forms" && (
                <FormsTab
                  t={t}
                  completed={completed}
                  onOpen={setOpenFormId}
                />
              )}

              {tab === "payment" && (
                <PaymentTab t={t} money={money} />
              )}

              {tab === "package" && hasPackage && (
                <PackageTab t={t} locale={locale} />
              )}
            </div>

            {/* Right / quiet vertical tab menu, subtle separator */}
            <nav
              aria-label={t("bookingManage.tabsLabel")}
              className="order-1 lg:order-2 flex gap-1 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible lg:border-l lg:border-line-soft lg:pl-5"
            >
              {TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "shrink-0 lg:w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] whitespace-nowrap transition-colors",
                      active
                        ? "bg-surface-warm text-ink font-medium"
                        : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                    )}
                  >
                    <Icon
                      name={item.icon}
                      size={16}
                      className={active ? "text-accent" : "text-ink-3"}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.count ? (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-soft text-accent text-micro font-medium">
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </Card>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-micro max-w-xl">{t("bookingManage.disclaimer")}</p>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/booking">
              <Button variant="ghost" size="sm" icon="arrow-left">
                {t("bookingManage.back")}
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                {t("bookingManage.backHome")}
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <BookingFooter />

      {/* Form modal — read-only for a pre-payment completed form, else fillable */}
      <Modal
        open={!!openForm}
        onClose={() => setOpenFormId(null)}
        title={openForm ? t(openForm.nameKey) : ""}
        description={openForm ? t(openForm.descKey) : undefined}
        footer={
          openForm ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenFormId(null)}>
                {t("common.close")}
              </Button>
              {!openFormReadOnly && (
                <Button
                  variant="primary"
                  icon="check"
                  onClick={() => saveForm(openForm.id)}
                  disabled={(formValues[openForm.id] ?? "").trim().length === 0}
                >
                  {t("bookingManage.forms.save")}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {openForm &&
          (openFormReadOnly ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-md bg-paper-2 px-3 py-2.5 text-small text-ink-2">
                <Icon name="lock" size={14} className="mt-0.5 text-ink-3 shrink-0" />
                <span>{t("bookingManage.forms.readonlyNote")}</span>
              </div>
              <div>
                <div className="eyebrow mb-1.5">{t(openForm.fieldKey)}</div>
                <p className="text-[14px] text-ink whitespace-pre-line">
                  {openForm.answerKey ? t(openForm.answerKey) : ""}
                </p>
              </div>
            </div>
          ) : (
            <Field label={t(openForm.fieldKey)} optional>
              <Textarea
                rows={4}
                autoFocus
                value={formValues[openForm.id] ?? ""}
                placeholder={
                  openForm.placeholderKey ? t(openForm.placeholderKey) : undefined
                }
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, [openForm.id]: e.target.value }))
                }
              />
            </Field>
          ))}
      </Modal>

      <ConfirmDialog
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onConfirm={() => {
          setRescheduleOpen(false);
          toast.info(t("bookingManage.reschedule.sent"), {
            description: t("bookingManage.reschedule.sentDesc"),
          });
        }}
        title={t("bookingManage.reschedule.title")}
        description={t("bookingManage.reschedule.body")}
        confirmLabel={t("bookingManage.reschedule.confirm")}
        cancelLabel={t("common.cancel")}
      />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          toast.info(t("bookingManage.cancel.sent"), {
            description: t("bookingManage.cancel.sentDesc"),
          });
        }}
        title={t("bookingManage.cancel.title")}
        description={t("bookingManage.cancel.body")}
        confirmLabel={t("bookingManage.cancel.confirm")}
        cancelLabel={t("common.cancel")}
        destructive
      />
    </div>
  );
}

type T = (key: keyof Messages, vars?: Record<string, string | number>) => string;

function BookingInfo({
  t,
  whenLabel,
  timeLabel,
  contextLine,
  allDone,
}: {
  t: T;
  whenLabel: string;
  timeLabel: string;
  contextLine: string;
  allDone: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Pill tone="success" icon="check">
          {t("bookingManage.status.confirmed")}
        </Pill>
      </div>
      <h2 className="text-h3 mb-4">{t("bookingManage.info.title")}</h2>
      <dl className="flex flex-col gap-3">
        <SummaryItem
          icon="briefcase"
          label={t("bookingManage.info.service")}
          value={DEMO.service}
        />
        <SummaryItem
          icon="user"
          label={t("bookingManage.info.provider")}
          value={DEMO.provider}
        />
        <SummaryItem
          icon="calendar"
          label={t("bookingManage.info.when")}
          value={`${whenLabel} · ${timeLabel}`}
        />
        <SummaryItem
          icon="video"
          label={t("bookingManage.info.location")}
          value={t("bookingManage.location.online")}
        />
        <SummaryItem
          icon="clipboard"
          label={t("bookingManage.info.reference")}
          value={DEMO.reference}
        />
      </dl>
      <div
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 text-[14px]",
          allDone ? "text-ink-3" : "text-accent",
        )}
      >
        <Icon name={allDone ? "check" : "spark"} size={15} strokeWidth={2} />
        {contextLine}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-md bg-paper-2 px-3 py-2.5 text-small text-ink-2">
        <Icon name="bell" size={14} className="mt-0.5 text-ink-3 shrink-0" />
        <span>{t("bookingManage.reminder")}</span>
      </div>
    </div>
  );
}

function ManageBooking({
  t,
  message,
  setMessage,
  onSend,
  onReschedule,
  onCancel,
}: {
  t: T;
  message: string;
  setMessage: (v: string) => void;
  onSend: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <section>
        <h2 className="text-h3 mb-2">{t("bookingManage.message.title")}</h2>
        <p className="text-small mb-3">{t("bookingManage.message.note")}</p>
        <Textarea
          rows={4}
          value={message}
          placeholder={t("bookingManage.message.placeholder")}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
            size="md"
            icon="mail"
            onClick={onSend}
            disabled={message.trim().length === 0}
          >
            {t("bookingManage.message.send")}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-h3 mb-2">{t("bookingManage.manage.title")}</h2>
        <p className="text-small mb-4">{t("bookingManage.manage.note")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            size="sm"
            icon="clock"
            className="sm:flex-1 justify-center"
            onClick={onReschedule}
          >
            {t("bookingManage.actions.reschedule")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon="x"
            className="sm:flex-1 justify-center"
            onClick={onCancel}
          >
            {t("bookingManage.actions.cancel")}
          </Button>
        </div>
      </section>
    </div>
  );
}

function FormsTab({
  t,
  completed,
  onOpen,
}: {
  t: T;
  completed: Record<string, boolean>;
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-h3 mb-2">{t("bookingManage.forms.title")}</h2>
      <p className="text-small mb-5">{t("bookingManage.forms.note")}</p>
      <ul className="flex flex-col gap-2.5">
        {FORMS.map((form) => {
          const isDone = !!completed[form.id];
          return (
            <li key={form.id}>
              <button
                type="button"
                onClick={() => onOpen(form.id)}
                className="group flex w-full items-center gap-3 rounded-md border border-line-soft bg-surface-warm px-4 py-3 text-left transition-colors hover:border-ink-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-ink truncate">
                    {t(form.nameKey)}
                  </span>
                  <span className="mt-1.5 inline-flex flex-wrap items-center gap-1.5">
                    <Pill tone={form.required ? "warning" : "neutral"}>
                      {form.required
                        ? t("bookingManage.forms.required")
                        : t("bookingManage.forms.optional")}
                    </Pill>
                    <Pill tone={isDone ? "success" : "neutral"} icon={isDone ? "check" : undefined}>
                      {isDone
                        ? t("bookingManage.forms.completed")
                        : t("bookingManage.forms.notCompleted")}
                    </Pill>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-micro text-accent shrink-0">
                  {isDone
                    ? t("bookingManage.forms.view")
                    : t("bookingManage.forms.open")}
                  <Icon name="arrow-right" size={13} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PaymentTab({ t, money }: { t: T; money: (cents: number) => string }) {
  const total = DEMO.amountCents + DEMO.taxCents;
  return (
    <div>
      <h2 className="text-h3 mb-4">{t("bookingManage.payment.title")}</h2>
      <dl className="flex flex-col gap-3">
        <SummaryItem
          icon="wallet"
          label={t("bookingManage.payment.method")}
          value={t("bookingManage.payment.manualLabel")}
        />
        <SummaryItem
          icon="clock"
          label={t("bookingManage.payment.statusLabel")}
          value={t("bookingManage.payment.statusValue")}
        />
      </dl>

      <div className="mt-5 rounded-md border border-line-soft bg-surface-warm px-4 py-3">
        <div className="flex items-center justify-between py-1 text-[14px]">
          <span className="text-ink-2">{DEMO.service}</span>
          <span className="text-ink">{money(DEMO.amountCents)}</span>
        </div>
        <div className="flex items-center justify-between py-1 text-[14px]">
          <span className="text-ink-2">{t("bookingManage.payment.subtotal")}</span>
          <span className="text-ink">{money(DEMO.amountCents)}</span>
        </div>
        <div className="flex items-center justify-between py-1 text-[14px]">
          <span className="text-ink-2">{t("bookingManage.payment.tax")}</span>
          <span className="text-ink">{money(DEMO.taxCents)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-line-soft pt-2 text-[14px] font-medium">
          <span className="text-ink">{t("bookingManage.payment.total")}</span>
          <span className="text-ink">{money(total)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-paper-2 border border-line-soft px-3 py-3">
        <div className="eyebrow mb-1.5">
          {t("bookingManage.payment.instructionsLabel")}
        </div>
        <p className="text-small whitespace-pre-line text-ink">
          {DEMO.manualInstructions}
        </p>
      </div>
    </div>
  );
}

function PackageTab({ t, locale }: { t: T; locale: string }) {
  const pkg = DEMO.package;
  // Ordinal session number within the package, 1-based.
  return (
    <div>
      <h2 className="text-h3 mb-4">{t("bookingManage.package.title")}</h2>
      <div className="rounded-md border border-line-soft bg-surface-warm px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <Icon name="layers" size={17} />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-ink">{pkg.name}</div>
            <div className="text-small mt-0.5">
              {t("bookingManage.package.session", {
                n: pkg.sessionIndex,
                total: pkg.sessionTotal,
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="text-small mt-4 mb-3">{t("bookingManage.package.note")}</p>

      <div className="eyebrow mb-2">{t("bookingManage.package.included")}</div>
      <ol className="flex flex-col gap-2">
        {pkg.items.map((item, i) => {
          const current = i + 1 === pkg.sessionIndex;
          return (
            <li
              key={`${item}-${i}`}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2.5",
                current
                  ? "border-accent/40 bg-accent-soft"
                  : "border-line-soft bg-surface",
              )}
            >
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-micro font-medium shrink-0",
                  current ? "bg-accent text-white" : "bg-paper-2 text-ink-2",
                )}
              >
                {(i + 1).toLocaleString(locale)}
              </span>
              <span
                className={cn(
                  "text-[14px]",
                  current ? "text-ink font-medium" : "text-ink-2",
                )}
              >
                {item}
              </span>
              {current && (
                <span className="ml-auto">
                  <Pill tone="success">{t("bookingManage.package.thisSession")}</Pill>
                </span>
              )}
            </li>
          );
        })}
      </ol>
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
