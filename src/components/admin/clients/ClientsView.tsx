"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { ClientCard } from "./ClientCard";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { listClients } from "@/services/clients.service";
import { eur } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { Client } from "@/types/client";

type Layout = "grid" | "rows";

export function ClientsView() {
  const [clients, setClients] = React.useState<Client[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [layout, setLayout] = React.useState<Layout>("grid");

  React.useEffect(() => {
    listClients().then(setClients);
  }, []);

  const filtered = (clients ?? []).filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        eyebrow="Directory"
        title="Clients"
        sub={clients ? `${clients.length} total` : "Loading…"}
        actions={
          <>
            <Button variant="secondary" size="md" icon="download">Export CSV</Button>
            <Button variant="primary" size="md" icon="plus">Add client</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
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

      {!clients ? (
        <LoadingRows count={5} />
      ) : layout === "grid" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <ClientCard key={c.id} client={c} />
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
                {eur(c.totalSpentCents)}
              </div>
              <StatusBadge kind="client" status={c.tag} />
            </Link>
          ))}
        </Card>
      )}
    </div>
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
