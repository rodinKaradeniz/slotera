import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CardHead } from "@/components/shared/CardHead";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import type { RecentBooking } from "@/types/dashboard";

type Props = { items: RecentBooking[] };

export function RecentBookings({ items }: Props) {
  return (
    <Card padded={false}>
      <CardHead
        title="Recent bookings"
        right={
          <Link href="/admin/bookings">
            <Button variant="ghost" size="sm" iconRight="arrow-right">
              View all
            </Button>
          </Link>
        }
      />
      <div>
        {items.map((b) => (
          <div
            key={b.id}
            className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0"
          >
            <Avatar name={b.client} size={32} />
            <div className="min-w-0">
              <div className="text-[14px] text-ink truncate">{b.client}</div>
              <div className="text-micro truncate">
                {b.service}
                {b.company && ` · ${b.company}`}
              </div>
            </div>
            <div className="text-small whitespace-nowrap">{b.when}</div>
            <StatusBadge kind="payment" status={b.pay} />
            <div className="text-[14px] text-ink font-medium whitespace-nowrap">
              {b.amount}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
