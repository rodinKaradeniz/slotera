"use client";

import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { CardHead } from "@/components/shared/CardHead";
import { Stat } from "@/components/shared/Stat";
import { Pill } from "@/components/ui/Pill";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { getPlatformOverview } from "@/services/platform.service";
import { PLAN_LABEL } from "@/lib/status-maps";
import { gbp } from "@/lib/money";
import { fmtDate, fmtRelative } from "@/lib/time";
import type { PlatformOverview } from "@/types/platform";

const EVENT_ICON: Record<PlatformOverview["recentEvents"][number]["type"], IconName> = {
  subscription_created: "sparkle",
  subscription_cancelled: "x",
  payment_failed: "alert",
  trial_ended: "clock",
  plan_changed: "refresh",
};

export function OverviewView() {
  const [data, setData] = React.useState<PlatformOverview | null>(null);

  React.useEffect(() => {
    getPlatformOverview().then(setData);
  }, []);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform"
        title="Platform overview"
        description="A read-out of registered workspaces, subscriptions, and recent activity across Slotera."
      />

      {!data ? (
        <LoadingRows count={3} />
      ) : (
        <div className="flex flex-col gap-6">
          <Card padded={false}>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-line-soft">
              <PadStat label="Total workspaces" value={String(data.totals.workspaces)} />
              <PadStat label="Active subscriptions" value={String(data.totals.activeSubscriptions)} />
              <PadStat label="Trialing accounts" value={String(data.totals.trialingAccounts)} />
              <PadStat label="MRR" value={gbp(data.totals.mrr)} />
            </div>
          </Card>

          <Card padded={false}>
            <div className="grid grid-cols-2 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line-soft">
              <PadStat label="Past due" value={String(data.totals.pastDue)} />
              <PadStat label="New signups this week" value={String(data.totals.newSignupsThisWeek)} />
              <PadStat label="Unread inquiries" value={String(data.totals.openInquiries)} />
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <Card padded={false}>
              <CardHead title="Recent workspaces" />
              {data.recentWorkspaces.map((w) => (
                <Link
                  key={w.id}
                  href={`/superadmin/workspaces/${w.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm"
                >
                  <div>
                    <div className="text-[14px] text-ink truncate">{w.name}</div>
                    <div className="text-small">{w.ownerName}</div>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Pill tone="neutral">{PLAN_LABEL[w.planId]}</Pill>
                    <span className="text-small">{fmtDate(new Date(w.createdAtISO), "short")}</span>
                  </div>
                </Link>
              ))}
            </Card>

            <Card padded={false}>
              <CardHead title="Recent activity" />
              {data.recentEvents.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start gap-3 px-5 py-3.5 border-b border-line-soft last:border-b-0"
                >
                  <span className="w-8 h-8 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center mt-0.5">
                    <Icon name={EVENT_ICON[e.type]} size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-ink">
                      <span className="font-medium">{e.workspaceName}</span>{" "}
                      <span className="text-ink-3">·</span> {e.description}
                    </div>
                    <div className="text-small">{fmtRelative(e.atISO)}</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function PadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5">
      <Stat label={label} value={value} />
    </div>
  );
}
