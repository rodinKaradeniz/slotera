"use client";

import * as React from "react";
import { Greeting, spell } from "./Greeting";
import { KpiTile } from "./KpiTile";
import { TrendChart } from "./TrendChart";
import { NextSessionCard } from "./NextSessionCard";
import { PendingActions } from "./PendingActions";
import { currentSession } from "@/services/auth.service";
import { getDashboard } from "@/services/dashboard.service";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { PageContainer } from "@/components/shared/PageContainer";
import type { DashboardData } from "@/types/dashboard";

function buildSubtitle(data: DashboardData): string {
  const todayCount = data.todaySchedule.length;
  const weekCount = data.weekStrip.reduce((acc, d) => acc + d.bookings.length, 0);
  const todayWord = todayCount === 1 ? "session" : "sessions";
  return `${spell(todayCount)} ${todayWord} today, ${spell(weekCount).toLowerCase()} on the books this week.`;
}

export function DashboardView() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [operatorName, setOperatorName] = React.useState<string>("");

  React.useEffect(() => {
    getDashboard().then(setData);
    setOperatorName(currentSession()?.operator.name ?? "");
  }, []);

  const next = data?.todaySchedule.find((t) => t.status === "next");
  const subtitle = data ? buildSubtitle(data) : undefined;

  return (
    <PageContainer>
      <Greeting operatorName={operatorName || "Lena Hartmann"} subtitle={subtitle} />

      {!data ? (
        <LoadingRows count={3} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid lg:grid-cols-3 gap-6 items-stretch">
            <div className="lg:col-span-2">
              <NextSessionCard item={next} schedule={data.todaySchedule} />
            </div>
            <div className="lg:col-span-1">
              <PendingActions items={data.pendingActions} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] items-stretch">
            <div className="grid grid-cols-2 gap-4">
              {data.kpis.map((k) => (
                <KpiTile key={k.id} kpi={k} />
              ))}
            </div>
            <TrendChart data={data.trend30d} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
