import dashboardJson from "@/data/mock/dashboard.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type { DashboardData } from "@/types/dashboard";
import { NotImplementedError } from "./_errors";

export async function getDashboard(): Promise<DashboardData> {
  if (dataSource !== "mock") throw new NotImplementedError("getDashboard");
  await sleep(80);
  return dashboardJson as unknown as DashboardData;
}
