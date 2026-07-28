"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { gbp } from "@/lib/money";
import type { Client } from "@/types/client";

export function ClientCard({ client }: { client: Client }) {
  return (
    <Link href={`/admin/clients/${client.id}`}>
      <Card hover className="cursor-pointer">
        <div className="flex items-start gap-3">
          <Avatar name={client.name} size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[15px] font-medium text-ink truncate">
                {client.name}
              </div>
              <StatusBadge kind="client" status={client.tag} />
            </div>
            <div className="text-small truncate">{client.company ?? client.email}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-line-soft text-center">
          <Stat label="Bookings" value={String(client.totalBookings)} />
          <Stat label="Completed" value={String(client.completedBookings)} />
          <Stat label="Spent" value={gbp(client.totalSpentCents)} />
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-micro">{label}</span>
      <span className="text-[14px] font-medium text-ink mt-0.5">{value}</span>
    </div>
  );
}
