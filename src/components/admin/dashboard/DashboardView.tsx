"use client";

import * as React from "react";
import { Greeting } from "./Greeting";
import { KpiTile } from "./KpiTile";
import { TrendChart } from "./TrendChart";
import { NextSessionCard } from "./NextSessionCard";
import { PendingActions } from "./PendingActions";
import { RecentBookings } from "./RecentBookings";
import { WeekStrip } from "./WeekStrip";
import { currentSession } from "@/services/auth.service";
import { getDashboard } from "@/services/dashboard.service";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { PageContainer } from "@/components/shared/PageContainer";
import type { DashboardData } from "@/types/dashboard";

export function DashboardView() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [operatorName, setOperatorName] = React.useState<string>("");

  React.useEffect(() => {
    getDashboard().then(setData);
    setOperatorName(currentSession()?.operator.name ?? "");
  }, []);

  const next = data?.todaySchedule.find((t) => t.status === "next");

  return (
    <PageContainer>
      <Greeting operatorName={operatorName || "Lena"} />

      {!data ? (
        <LoadingRows count={3} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <NextSessionCard item={next} />
            <PendingActions items={data.pendingActions} />
          </div>

          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
            <div className="grid grid-cols-2 gap-6">
              {data.kpis.map((k) => (
                <KpiTile key={k.id} kpi={k} />
              ))}
            </div>
            <TrendChart data={data.trend30d} />
          </div>

          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
            <RecentBookings items={data.recentBookings} />
            <WeekStrip days={data.weekStrip} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
