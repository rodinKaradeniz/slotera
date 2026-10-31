import { describe, expect, it } from "vitest";
import { NotFoundError } from "./_errors";
import { getClient, updateClient } from "./clients.service";
import { listSessions, updateSession } from "./sessions.service";

// Mock mode: a patch merges into the stored record, and an unknown id is an error, not a no-op.
describe("mock services patch", () => {
  it("merges a session patch and keeps the other fields", async () => {
    const [first] = await listSessions();
    const next = await updateSession(first.id, { notes: "Bring the draft" });
    expect(next.notes).toBe("Bring the draft");
    expect(next.startISO).toBe(first.startISO);
    expect((await listSessions()).find((s) => s.id === first.id)?.notes).toBe("Bring the draft");
  });

  it("throws NotFoundError for an unknown session or client", async () => {
    await expect(updateSession("ses-missing", { notes: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateClient("cli-missing", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns null for an unknown client", async () => {
    const created = await getClient("cli-missing");
    expect(created).toBeNull();
  });
});
