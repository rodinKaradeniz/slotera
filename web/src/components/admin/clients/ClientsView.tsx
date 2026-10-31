"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { plural } from "@/lib/text";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { ClientCard } from "./ClientCard";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { listClients } from "@/services/clients.service";
import { formatMoney } from "@/lib/money";
import { toCsv, downloadText } from "@/lib/csv";
import { useLoad } from "@/lib/use-load";
import { LoadError } from "@/components/shared/LoadError";
import { useWorkspaceCurrency } from "@/lib/use-workspace-currency";
import { cn } from "@/lib/cn";
import { useDrawers } from "@/components/drawers/DrawersProvider";

type Layout = "grid" | "rows";

export function ClientsView() {
  const { openClientDrawer } = useDrawers();
  const { data: clients, error, reload } = useLoad(listClients);
  const [query, setQuery] = React.useState("");
  const [layout, setLayout] = React.useState<Layout>("grid");
  const currency = useWorkspaceCurrency();

  const filtered = (clients ?? []).filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    const text = toCsv(filtered, [
      { header: "Name", value: (c) => c.name },
      { header: "Email", value: (c) => c.email },
      { header: "Phone", value: (c) => c.phone ?? "" },
      { header: "Company", value: (c) => c.company ?? "" },
      { header: "Status", value: (c) => c.tag },
      { header: "Bookings", value: (c) => c.totalBookings },
      { header: "Completed", value: (c) => c.completedBookings },
      { header: "Cancelled", value: (c) => c.cancelledBookings },
      { header: `Spent (${currency})`, value: (c) => (c.totalSpentCents / 100).toFixed(2) },
      { header: "Client since", value: (c) => c.joinedISO.slice(0, 10) },
    ]);
    downloadText(`slotera-clients-${new Date().toISOString().slice(0, 10)}.csv`, text);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Directory"
        title="Clients"
        description="Everyone who has booked with you, with lifetime spend and activity."
        meta={
          clients
            ? `${plural(clients.length, "client")} · ${
                clients.filter((c) => c.tag === "active").length
              } active`
            : "Loading…"
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon="download"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              Export CSV
            </Button>
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
              Add client
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[220px]">
          <Input
            icon="search"
            placeholder="Search by name, company, or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
      ) : layout === "grid" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <ClientCard key={c.id} client={c} currency={currency} />
          ))}
        </div>
      ) : (
        <Card padded={false}>
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
                {c.totalBookings} bookings
              </div>
              <div className="text-[14px] font-medium text-ink whitespace-nowrap">
                {formatMoney(c.totalSpentCents, currency)}
              </div>
              <StatusBadge kind="client" status={c.tag} />
            </Link>
          ))}
        </Card>
      )}
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
