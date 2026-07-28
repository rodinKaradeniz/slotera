import settingsJson from "@/data/mock/settings.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import type { SettingsData } from "@/types/settings";
import { NotImplementedError } from "./_errors";

let mock: SettingsData = JSON.parse(JSON.stringify(settingsJson)) as SettingsData;

export async function getSettings(): Promise<SettingsData> {
  if (dataSource !== "mock") throw new NotImplementedError("getSettings");
  await sleep(60);
  return mock;
}

export async function updateSettings(
  patch: Partial<SettingsData>,
): Promise<SettingsData> {
  if (dataSource !== "mock") throw new NotImplementedError("updateSettings");
  await sleep(120);
  mock = { ...mock, ...patch } as SettingsData;
  return mock;
}
