"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { readLang, translate } from "@/lib/i18n";
import * as React from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { Greeting, spell } from "./Greeting";
import { KpiTile } from "./KpiTile";
import { TrendChart } from "./TrendChart";
import { NextSessionCard, ScheduleCard } from "./NextSessionCard";
import { TodoList } from "./TodoList";
import { currentSession } from "@/services/auth.service";
import { getDashboard } from "@/services/dashboard.service";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { LoadError } from "@/components/shared/LoadError";
import { useLoad } from "@/lib/use-load";
import { PageContainer } from "@/components/shared/PageContainer";
import type { DashboardData } from "@/types/dashboard";

function buildSubtitle(data: DashboardData): string {
  const todayCount = data.todaySchedule.length;
  const weekCount = data.weekSessionCount ?? data.weekStrip.reduce((acc, d) => acc + d.bookings.length, 0);
  if (readLang() !== "en") return translate(readLang(), "dashboard.summary", { today: todayCount, week: weekCount });
  const todayWord = todayCount === 1 ? "session" : "sessions";
  return `${spell(todayCount)} ${todayWord} today, ${spell(weekCount).toLowerCase()} on the books this week.`;
}

export function DashboardView() {
  const { lang } = useI18n();
  const load = React.useCallback(() => getDashboard(lang), [lang]);
  const { data, error, reload } = useLoad(load);
  const hydrated = useHydrated();
  const op = hydrated ? currentSession()?.operator : undefined;
  const firstName =
    op?.firstNames?.trim().split(/\s+/)[0] ?? op?.name?.split(/\s+/)[0] ?? "";

  const next = data?.nextSession ?? data?.todaySchedule.find((t) => t.status === "next");
  const subtitle = data ? buildSubtitle(data) : undefined;

  return (
    <PageContainer>
      <Greeting firstName={firstName} subtitle={subtitle} />

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <LoadingRows count={3} />
      ) : (
        <div className="flex flex-col gap-6">
          {/* The left column (next call, then today's schedule) sets the row's height; the
              to-do fills the same height beside it and scrolls inside. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div className="min-w-0 lg:col-span-2 flex flex-col gap-6">
              <NextSessionCard item={next} onChanged={reload} />
              <ScheduleCard schedule={data.todaySchedule} />
            </div>
            <div className="min-w-0 lg:col-span-1 lg:relative">
              <TodoList className="lg:absolute lg:inset-0" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] items-stretch">
            <div className="grid grid-cols-2 gap-4">
              {data.kpis.map((k) => (
                <KpiTile key={k.id} kpi={k} />
              ))}
            </div>
            <TrendChart data={data.trend30d} currency={data.currency} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
