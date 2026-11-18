"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { collectionMeta } from "@/lib/collection-meta";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { ClientCard } from "./ClientCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { dataSource } from "@/lib/env";
import { Pagination } from "@/components/shared/Pagination";
import { useToast } from "@/components/ui/Toast";
import { exportClientDirectory, listClientPage } from "@/services/clients.service";
import { formatMoney } from "@/lib/money";
import { toCsv, downloadText } from "@/lib/csv";
import { useLoad } from "@/lib/use-load";
import { LoadError } from "@/components/shared/LoadError";
import { useWorkspaceCurrency } from "@/lib/use-workspace-currency";
import { cn } from "@/lib/cn";
import { useDrawers } from "@/components/drawers/DrawersProvider";

type Layout = "grid" | "rows";

export function ClientsView() {
  const { t: uiText, lang } = useI18n();
  const { toast } = useToast();
  const [exporting, setExporting] = React.useState(false);
  const { openClientDrawer } = useDrawers();
  const [query, setQuery] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const load = React.useCallback(async (signal?: AbortSignal) => listClientPage(query, offset, signal), [query, offset]);
  const { data: page, error, reload, loading } = useLoad(load);
  const clients = page?.items;
  const [layout, setLayout] = React.useState<Layout>("grid");
  const currency = useWorkspaceCurrency();

  const filtered = (clients ?? []).filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      dataSource === "api" || c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q)
    );
  });

  const exportCsv = async () => {
    if (dataSource === "api") {
      setExporting(true);
      try { downloadText("slotera-clients.csv", await exportClientDirectory(query)); }
      catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
      finally { setExporting(false); }
      return;
    }
    const text = toCsv(filtered, [
      { header: uiText("ui.name"), value: (c) => c.name },
      { header: uiText("ui.email"), value: (c) => c.email },
      { header: uiText("ui.phone"), value: (c) => c.phone ?? "" },
      { header: uiText("ui.company"), value: (c) => c.company ?? "" },
      { header: uiText("ui.status"), value: (c) => c.tag },
      { header: uiText("ui.bookings"), value: (c) => c.totalBookings },
      { header: uiText("ui.completed"), value: (c) => c.completedBookings },
      { header: uiText("ui.cancelled"), value: (c) => c.cancelledBookings },
      { header: uiText("ui.spent.currency", { currency }), value: (c) => (c.totalSpentCents / 100).toFixed(2) },
      { header: "Client since", value: (c) => c.joinedISO.slice(0, 10) },
    ]);
    downloadText(`slotera-clients-${new Date().toISOString().slice(0, 10)}.csv`, text);
  };

  return (
    <PageContainer>
      <PageHeader
        title={uiText("ui.clients")}
        description={uiText("ui.everyone.who.has.booked.with.you.with.lifetime.spend.and.activity")}
        meta={clients ? collectionMeta("clients", page?.states ?? {}, lang) : uiText("ui.loading")}
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon="download"
              onClick={exportCsv}
              loading={exporting}
              disabled={filtered.length === 0}
            >
              {uiText("ui.export.csv")}</Button>
            <Button
              variant="primary"
              size="md"
              icon="plus"
              onClick={() =>
                openClientDrawer({
                  onSaved: reload,
                })
              }
            >
              {uiText("ui.add.client")}</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[220px]">
          <Input
            icon="search"
            placeholder={uiText("ui.search.by.name.company.or.email")}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOffset(0); }}
          />
        </div>
        <div className="flex items-center bg-surface border border-line rounded-md p-0.5">
          <LayoutBtn active={layout === "grid"} onClick={() => setLayout("grid")} icon="grid" />
          <LayoutBtn active={layout === "rows"} onClick={() => setLayout("rows")} icon="menu" />
        </div>
      </div>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !clients ? (
        <LoadingRows count={5} />
      ) : filtered.length === 0 ? (
        query.trim() ? (
          <EmptyState icon="search" title={uiText("empty.filtered.title")} body={uiText("empty.filtered.body")} />
        ) : (
          <EmptyState icon="users" title={uiText("empty.clients.title")} body={uiText("empty.clients.body")} />
        )
      ) : layout === "grid" ? (
        <div className="list-rise grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <ClientCard key={c.id} client={c} currency={currency} />
          ))}
        </div>
      ) : (
        <Card padded={false} className="list-rise">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.id}`}
              className="grid grid-cols-[auto_2fr_2fr_1fr_1fr_auto] items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm"
            >
              <Avatar name={c.name} size={32} />
              <div className="min-w-0">
                <div className="text-[14px] text-ink truncate">{c.name}</div>
                <div className="text-micro truncate">{c.company ?? c.email}</div>
              </div>
              <div className="text-small truncate">{c.email}</div>
              <div className="text-small whitespace-nowrap">
                {c.totalBookings} {uiText("ui.bookings")}</div>
              <div className="text-[14px] font-medium text-ink whitespace-nowrap">
                {formatMoney(c.totalSpentCents, currency)}
              </div>
              <StatusBadge kind="client" status={c.tag} />
            </Link>
          ))}
        </Card>
      )}
      {page && <Pagination total={page.total} offset={offset} onChange={setOffset} loading={loading} />}
    </PageContainer>
  );
}

function LayoutBtn({
  active,
  onClick,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  icon: "grid" | "menu";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-8 h-8 rounded-[5px] flex items-center justify-center",
        active ? "bg-paper-2 text-ink" : "text-ink-3 hover:text-ink",
      )}
      aria-label={`${icon} layout`}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
