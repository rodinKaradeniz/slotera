"use client";

/** The demo manage page's tab contents. */

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import type { Messages } from "@/i18n/messages/en";

export const DEMO = {
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
    "Bank transfer to: Hartmann Strategy · IBAN GB00 SLOT 0000 0000 0000 00 · Reference SLT-DEMO1",
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

export const FORMS: DemoForm[] = [
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

type T = (key: keyof Messages, vars?: Record<string, string | number>) => string;

export function BookingInfo({
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

export function ManageBooking({
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

export function FormsTab({
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

export function PaymentTab({ t, money }: { t: T; money: (cents: number) => string }) {
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

export function PackageTab({ t, locale }: { t: T; locale: string }) {
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
