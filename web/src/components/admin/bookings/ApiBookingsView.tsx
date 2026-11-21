"use client";

import { DATA_CHANGED } from "@/api/query-cache";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadError } from "@/components/shared/LoadError";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { AccordionItem } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { Select } from "@/components/ui/Select";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import { downloadText } from "@/lib/csv";
import { searchServiceOptions } from "@/services/services.service";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { exportBookingSummaries, listBookingSummaries, type BookingSummaryPage } from "@/services/bookings.service";
import { BOOKING_STATUS } from "@/lib/status-maps";
import { translateInterfaceLabel, localeForLang } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { BookingStatus } from "@/types/common";

const STATUSES: BookingStatus[] = ["pending", "confirmed", "completed", "noshow", "cancelled"];

export function ApiBookingsView() {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [exporting, setExporting] = React.useState(false);
  const [serviceId, setServiceId] = React.useState("");
  const [options, setOptions] = React.useState<{ id: string; name: string }[]>([]);
  const [serviceError, setServiceError] = React.useState<string | null>(null);
  const [serviceAttempt, setServiceAttempt] = React.useState(0);
  const [selectedService, setSelectedService] = React.useState<{id: string; name: string} | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    // One list of services for the filter; the page's own search box covers the rest.
    searchServiceOptions("", controller.signal).then((items) => { if (!controller.signal.aborted) {setOptions(items); setServiceError(null);} }).catch((error: unknown) => { if (!controller.signal.aborted) setServiceError(error instanceof Error ? error.message : String(error)); });
    return () => controller.abort();
  }, [serviceAttempt]);
  const params = useSearchParams();
  const clientId = params.get("client") ?? undefined;
  const { openBookingDrawer } = useDrawers();
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => window.removeEventListener(DATA_CHANGED, refresh);
  }, []);
  const filterKey = JSON.stringify([query, serviceId, clientId]);
  const [countResult, setCountResult] = React.useState<{ key: string; page: BookingSummaryPage } | null>(null);
  const counts = countResult?.key === filterKey ? countResult.page.statusCounts : {};
  const updateCounts = React.useCallback((page: BookingSummaryPage) => {
    setCountResult({ key: filterKey, page });
  }, [filterKey]);
  React.useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const reload = () => setRevision((value) => value + 1);
  return <PageContainer>
    <PageHeader title={t("ui.bookings")} meta={countResult?.key === filterKey ? `${Object.values(counts).reduce((sum, value) => sum + value, 0)} ${t("ui.bookings")} · ${t("ui.pending.payment.count", {count: countResult.page.pendingPaymentCount})}` : t("ui.loading")}
      description={t("ui.all.client.bookings.across.1.1.calls.group.classes.and.workshops")}
      actions={<><Button icon="download" variant="secondary" loading={exporting} onClick={async () => {
        setExporting(true);
        try { downloadText("slotera-bookings.csv", await exportBookingSummaries({ search: query, clientId, serviceId: serviceId || undefined })); }
        catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
        finally { setExporting(false); }
      }}>{t("ui.export")}</Button><Button icon="plus" onClick={() => openBookingDrawer({ onSaved: reload })}>{t("ui.new.booking")}</Button></>} />
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 min-w-0">
        <Input icon="search" placeholder={t("ui.search.by.client.service.or.id")} value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </div>
      <Select className="sm:w-56" value={serviceId} onChange={(event) => {
        setServiceId(event.target.value);
        setSelectedService(options.find((option) => option.id === event.target.value) ?? null);
      }} options={[{ value: "", label: t("ui.all.services") },
        ...((selectedService && !options.some((option) => option.id === selectedService.id)) ? [selectedService] : []),
        ...options].map((item) => "value" in item ? item : ({value: item.id, label: item.name}))} />
    </div>
    {serviceError && <LoadError message={serviceError} onRetry={() => setServiceAttempt((value) => value + 1)} />}
    {clientId && <Button variant="ghost" onClick={() => router.replace("/admin/bookings")}>{t("ui.filtered.by.client")} ×</Button>}
    <div className="list-rise flex flex-col gap-3 mt-6">
      {STATUSES.map((status) => <BookingGroup key={`${query}:${serviceId}:${clientId ?? ""}:${status}`}
        revision={revision} status={status} search={query} clientId={clientId} serviceId={serviceId || undefined} count={counts[status]} previews={countResult?.key === filterKey ? countResult.page.statusPreviews[status] : undefined}
        onCounts={updateCounts} />)}
    </div>
  </PageContainer>;
}

function BookingGroup({ revision, status, search, clientId, serviceId, count, previews, onCounts }: {
  revision: number; status: BookingStatus; search: string; clientId?: string; serviceId?: string; count?: number; previews?: BookingSummaryPage["items"];
  onCounts: (page: BookingSummaryPage) => void;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const timezone = useWorkspaceTimezone();
  const [open, setOpen] = React.useState(status === "pending");
  const [offset, setOffset] = React.useState(0);
  const [attempt, setAttempt] = React.useState(0);
  const [page, setPage] = React.useState<BookingSummaryPage | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    listBookingSummaries({ status, search, clientId, serviceId, offset }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setPage(result);
      setError(null);
      onCounts(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, status, search, clientId, serviceId, offset, attempt, onCounts, revision]);
  // Same as the demo list: an empty group is a flat, muted line rather than a panel.
  if (count === 0) {
    return <div className="flex items-center gap-3 rounded-lg border border-line-soft px-5 py-3 text-small text-ink-3">
      {translateInterfaceLabel(lang, BOOKING_STATUS[status].label)} · 0
    </div>;
  }
  return <AccordionItem open={open} onToggle={() => { if (!open) setLoading(true); setOpen((value) => !value); }}
    header={<span>{translateInterfaceLabel(lang, BOOKING_STATUS[status].label)} · {count ?? "…"}{!open && previews?.length ? <span className="text-small ml-3">{previews.map((item) => item.clientName).join(", ")}</span> : null}</span>}>
    {error && <LoadError message={error} onRetry={() => {setLoading(true); setAttempt((value) => value + 1);}} />}
    {loading && !page ? <LoadingRows /> : page && <>
      {page.items.length === 0 && <p className="p-5 text-small">{t("ui.no.bookings.in.this.status")}</p>}
      {page.items.map((item) => <button type="button" key={item.id}
        onClick={() => router.push(`/admin/bookings/${encodeURIComponent(item.id)}`)}
        className="w-full flex flex-wrap items-center gap-4 justify-between px-5 py-4 text-left border-b border-line-soft hover:bg-surface-warm">
        <span className="min-w-0 flex-1"><span className="block font-medium">{item.clientName}</span><span className="text-small">{item.serviceName}</span></span>
        <span className="text-small">{new Intl.DateTimeFormat(localeForLang(lang), { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(item.startAt))}</span>
        {item.paymentStatus !== status && <StatusBadge kind="payment" status={item.paymentStatus} />}<span>{item.coveredByPackage ? t("booking.package.marker") : formatMoney(item.amountCents, item.currency)}</span>
      </button>)}
      {page.total > 25 && <div className="flex items-center justify-between gap-3 p-4">
        <Button variant="secondary" disabled={loading || offset === 0} aria-label={t("common.back")} onClick={() => {setLoading(true); setOffset(Math.max(0, offset - 25));}}>←</Button>
        <span className="text-small">{page.total === 0 ? 0 : page.offset + 1}–{page.offset + page.items.length} / {page.total}</span>
        <Button variant="secondary" disabled={loading || offset + page.items.length >= page.total} aria-label={t("common.continue")} onClick={() => {setLoading(true); setOffset(offset + 25);}}>→</Button>
      </div>}
    </>}
  </AccordionItem>;
}
