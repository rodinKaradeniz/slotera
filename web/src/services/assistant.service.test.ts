import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ dataSource: "mock" }));
import {
  branchAIThread,
  clearAIHistory,
  createAIThread,
  generateAITurn,
  getAIStatus,
  listAITurns,
  stopAITurn,
} from "./assistant.service";
afterEach(async () => {
  vi.useRealTimers();
  await clearAIHistory();
});
it("keeps an early Stop when generation arrives afterwards", async () => {
  const thread = await createAIThread(
    crypto.randomUUID(),
    "Synthetic stopped chat",
  );
  const key = crypto.randomUUID();
  await stopAITurn(thread.id, key, "Synthetic question", "en");
  const result = await generateAITurn(
    thread.id,
    "Synthetic question",
    "en",
    key,
  );
  expect(result.errorCode).toBe("ai_cancelled");
  expect(result.answer).toBe("");
  expect((await getAIStatus()).dailyAnswers).toBe(0);
});
it("branches by conversation order even when timestamps are identical", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
  const thread = await createAIThread(crypto.randomUUID(), "Synthetic chat");
  await generateAITurn(thread.id, "First question", "en", crypto.randomUUID());
  const second = await generateAITurn(
    thread.id,
    "Second question",
    "en",
    crypto.randomUUID(),
  );
  const branch = await branchAIThread(
    thread.id,
    second.id,
    crypto.randomUUID(),
    "Edited question",
  );
  const copy = await listAITurns(branch.id);
  expect(copy.items.map((row) => row.prompt)).toEqual(["First question"]);
  expect((await listAITurns(thread.id)).items).toHaveLength(2);
});
