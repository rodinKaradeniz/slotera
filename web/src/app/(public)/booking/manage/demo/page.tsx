"use client";

import { TabPanel } from "@/components/ui/Tabs";
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
import { DEMO, FORMS, BookingInfo, ManageBooking, FormsTab, PaymentTab, PackageTab } from "@/components/booking/manage-demo/DemoManageTabs";

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
            <TabPanel value={tab} order={TABS.map((item) => item.id)} className="order-2 lg:order-1 min-w-0">
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
            </TabPanel>

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
                      "press shrink-0 lg:w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] whitespace-nowrap",
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
