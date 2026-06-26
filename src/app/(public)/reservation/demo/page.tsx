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
import { cn } from "@/lib/cn";
import { listClientActionItemsForSession } from "@/services/session-action-items.service";
import { listClientResourcesForSession } from "@/services/resources.service";
import type { SessionActionItem } from "@/types/session-action-item";
import type { ResourceKind, ResourceLink } from "@/types/resource-link";
import type { Messages } from "@/i18n/messages/en";

/**
 * Mocked, public, no-auth preview of the customer reservation workspace.
 * A cleaner two-column layout: a priority summary hero up top, then a wider
 * left column (next steps, preparation/forms, resources, message provider) and
 * a narrower right column (reservation details, payment, package, manage). It
 * answers "what did I book / what do I need to do / how do I manage it" fast.
 *
 * Everything here is mocked: no IDs, tokens, persistence, or email. Internal
 * admin notes are never exposed — only `clientVisible` action items and
 * resources. See CLAUDE.md → "Customer reservation workspace (demo)".
 */
const DEMO_SESSION_ID = "ses-demo";

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
  manualInstructions:
    "Bank transfer to: Velora Labs · IBAN GB00 SLOT 0000 0000 0000 00 · Reference SLT-DEMO1",
  // Display-only package context — no credit ledger or balance accounting.
  package: {
    name: "Strategy Sprint Package",
    sessionIndex: 1,
    sessionTotal: 3,
  },
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

const RESOURCE_ICON: Record<ResourceKind, IconName> = {
  guide: "file",
  worksheet: "clipboard",
  document: "download",
  link: "link",
};

const RESOURCE_KIND_KEY: Record<ResourceKind, keyof Messages> = {
  guide: "reservation.resources.kind.guide",
  worksheet: "reservation.resources.kind.worksheet",
  document: "reservation.resources.kind.document",
  link: "reservation.resources.kind.link",
};

export default function ReservationDemoPage() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const locale = localeForLang(lang);

  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [completed, setCompleted] = React.useState<Record<string, boolean>>({});
  const [message, setMessage] = React.useState("");
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  // Shared next steps + resources from the provider. Marking a step "done" is
  // local-only — nothing is persisted back to the provider.
  const [steps, setSteps] = React.useState<SessionActionItem[] | null>(null);
  const [stepsDone, setStepsDone] = React.useState<Record<string, boolean>>({});
  const [resources, setResources] = React.useState<ResourceLink[] | null>(null);

  const stepsRef = React.useRef<HTMLDivElement>(null);
  const messageRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    let live = true;
    listClientActionItemsForSession(DEMO_SESSION_ID).then((items) => {
      if (live) setSteps(items);
    });
    listClientResourcesForSession(DEMO_SESSION_ID).then((items) => {
      if (live) setResources(items);
    });
    return () => {
      live = false;
    };
  }, []);

  const toggleStep = (item: SessionActionItem) => {
    const nowDone = !stepsDone[item.id];
    setStepsDone((s) => ({ ...s, [item.id]: nowDone }));
    if (nowDone) {
      toast.success(t("reservation.steps.marked"), {
        description: t("reservation.steps.markedDesc"),
      });
    }
  };

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

  const openResource = (e: React.MouseEvent) => {
    // Display-only/mock — no real download or navigation.
    e.preventDefault();
    toast.info(t("reservation.resources.opened"), {
      description: t("reservation.resources.openedDesc"),
    });
  };

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (ref === messageRef) messageRef.current?.focus();
  };

  // Priority context line: how many things are still to complete before the
  // session (open client steps + un-completed optional forms).
  const openSteps = (steps ?? []).filter((s) => !stepsDone[s.id]).length;
  const pendingForms = OPTIONAL_FORMS.filter((f) => !completed[f.id]).length;
  const todoCount = openSteps + pendingForms;
  const contextLine =
    todoCount === 0
      ? t("reservation.hero.context.none")
      : todoCount === 1
        ? t("reservation.hero.context.one")
        : t("reservation.hero.context.many", { n: todoCount });

  const hasSteps = !!steps && steps.length > 0;
  const hasResources = !!resources && resources.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-[1080px] mx-auto w-full px-6 pt-10 pb-12">
        <div className="flex flex-col gap-2 mb-6">
          <div>
            <Pill tone="neutral" icon="info">
              {t("reservation.badge")}
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
            {t("reservation.title")}
          </h1>
          <p className="text-body text-ink-3 max-w-2xl">
            {t("reservation.subtitle")}
          </p>
        </div>

        {/* Priority summary hero — what did I book + what's left to do */}
        <Card padded className="mb-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Pill tone="success" icon="check">
                  {t("reservation.status.confirmed")}
                </Pill>
              </div>
              <h2
                className="font-serif text-ink"
                style={{ fontSize: 24, fontWeight: 400, lineHeight: 1.15 }}
              >
                {DEMO.service}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="calendar" size={14} className="text-ink-3" />
                  {`${whenLabel} · ${timeLabel}`}
                </span>
                <span className="text-ink-4">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="user" size={14} className="text-ink-3" />
                  {DEMO.provider}
                </span>
              </div>
              <div
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 text-[14px]",
                  todoCount === 0 ? "text-ink-3" : "text-accent",
                )}
              >
                <Icon
                  name={todoCount === 0 ? "check" : "spark"}
                  size={15}
                  strokeWidth={2}
                />
                {contextLine}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
              {hasSteps && (
                <Button
                  variant="primary"
                  size="sm"
                  icon="check"
                  onClick={() => scrollTo(stepsRef)}
                >
                  {t("reservation.hero.reviewSteps")}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                icon="mail"
                onClick={() => scrollTo(messageRef)}
              >
                {t("reservation.hero.message")}
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
          {/* Left / main column */}
          <div className="flex flex-col gap-6">
            {/* Shared next steps (client-visible action items) */}
            {hasSteps && (
              <section ref={stepsRef} className="scroll-mt-24">
                <Card padded>
                  <h2 className="text-h3 mb-1">{t("reservation.steps.title")}</h2>
                  <p className="text-small mb-5">{t("reservation.steps.note")}</p>
                  <ul className="flex flex-col gap-2.5">
                    {steps!.map((step) => {
                      const done = stepsDone[step.id] ?? false;
                      return (
                        <li
                          key={step.id}
                          className="flex items-start gap-3 rounded-md border border-line-soft bg-surface-warm px-4 py-3"
                        >
                          <button
                            type="button"
                            onClick={() => toggleStep(step)}
                            aria-label={
                              done
                                ? t("reservation.steps.markTodo")
                                : t("reservation.steps.markDone")
                            }
                            className={cn(
                              "mt-0.5 w-[20px] h-[20px] rounded-[6px] border flex items-center justify-center shrink-0 transition-colors",
                              done
                                ? "bg-accent border-accent text-white"
                                : "border-line hover:border-ink-3 bg-surface",
                            )}
                          >
                            {done && (
                              <Icon name="check" size={13} strokeWidth={2.5} />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "text-[14px] text-ink",
                                done && "line-through text-ink-3",
                              )}
                            >
                              {step.title}
                            </div>
                            {step.description && (
                              <p className="text-small mt-0.5">
                                {step.description}
                              </p>
                            )}
                            {step.dueDate && (
                              <div className="mt-1.5">
                                <Pill tone="neutral" icon="calendar">
                                  {`${t("reservation.steps.due")} ${new Date(
                                    step.dueDate,
                                  ).toLocaleDateString(locale, {
                                    day: "numeric",
                                    month: "long",
                                  })}`}
                                </Pill>
                              </div>
                            )}
                          </div>
                          {done && (
                            <Pill tone="success" icon="check">
                              {t("reservation.steps.doneBadge")}
                            </Pill>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>
            )}

            {/* Preparation / optional forms */}
            <section className="scroll-mt-24">
              <Card padded>
                <h2 className="text-h3 mb-2">{t("reservation.forms.title")}</h2>
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
                              form.placeholderKey
                                ? t(form.placeholderKey)
                                : undefined
                            }
                            onChange={(e) =>
                              setFormValues((v) => ({
                                ...v,
                                [form.id]: e.target.value,
                              }))
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
                          disabled={
                            (formValues[form.id] ?? "").trim().length === 0
                          }
                        >
                          {t("reservation.forms.save")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* Shared resources */}
            {hasResources && (
              <section className="scroll-mt-24">
                <Card padded>
                  <h2 className="text-h3 mb-1">
                    {t("reservation.resources.title")}
                  </h2>
                  <p className="text-small mb-5">
                    {t("reservation.resources.note")}
                  </p>
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {resources!.map((res) => {
                      const kind = res.kind ?? "link";
                      return (
                        <li key={res.id}>
                          <a
                            href={res.url}
                            onClick={openResource}
                            className="group flex h-full items-start gap-3 rounded-md border border-line-soft bg-surface-warm px-4 py-3 transition-colors hover:border-ink-3"
                          >
                            <span className="w-9 h-9 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
                              <Icon name={RESOURCE_ICON[kind]} size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="block text-[14px] font-medium text-ink truncate">
                                  {res.title}
                                </span>
                              </span>
                              {res.description && (
                                <span className="block text-small mt-0.5">
                                  {res.description}
                                </span>
                              )}
                              <span className="mt-2 inline-flex items-center gap-1.5">
                                <Pill tone="neutral">
                                  {t(RESOURCE_KIND_KEY[kind])}
                                </Pill>
                                <span className="inline-flex items-center gap-0.5 text-micro text-accent">
                                  {t("reservation.resources.open")}
                                  <Icon name="arrow-right" size={12} />
                                </span>
                              </span>
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>
            )}

            {/* Message provider */}
            <section>
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
          </div>

          {/* Right / sidebar column */}
          <div className="flex flex-col gap-6">
            {/* Reservation details */}
            <Card padded>
              <h2 className="text-h3 mb-4">{t("reservation.details.title")}</h2>
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
                  icon="clipboard"
                  label={t("reservation.summary.reference")}
                  value={DEMO.reference}
                />
              </dl>
              <div className="mt-4 flex items-start gap-2 rounded-md bg-paper-2 px-3 py-2.5 text-small text-ink-2">
                <Icon name="bell" size={14} className="mt-0.5 text-ink-3 shrink-0" />
                <span>{t("reservation.reminder")}</span>
              </div>
            </Card>

            {/* Payment */}
            <Card padded>
              <h2 className="text-h3 mb-4">{t("reservation.payment.title")}</h2>
              <dl className="flex flex-col gap-3">
                <SummaryItem
                  icon="wallet"
                  label={t("reservation.summary.payment")}
                  value={t("reservation.payment.manualLabel")}
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

            {/* Package context (display-only) */}
            <Card padded>
              <h2 className="text-h3 mb-4">{t("reservation.package.title")}</h2>
              <SummaryItem
                icon="layers"
                label={DEMO.package.name}
                value={t("reservation.package.session", {
                  n: DEMO.package.sessionIndex,
                  total: DEMO.package.sessionTotal,
                })}
              />
            </Card>

            {/* Manage reservation */}
            <Card padded>
              <h2 className="text-h3 mb-2">{t("reservation.manage.title")}</h2>
              <p className="text-small mb-4">{t("reservation.manage.note")}</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="clock"
                  className="w-full justify-center"
                  onClick={() => setRescheduleOpen(true)}
                >
                  {t("reservation.actions.rescheduleLabel")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="x"
                  className="w-full justify-center"
                  onClick={() => setCancelOpen(true)}
                >
                  {t("reservation.actions.cancelLabel")}
                </Button>
              </div>
            </Card>
          </div>
        </div>

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
