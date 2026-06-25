export type SessionActionItemStatus = "todo" | "done";

/**
 * A lightweight admin task attached to a session — pre/post-session prep the
 * operator wants to track (e.g. "Send proposal summary", "Share prep checklist").
 *
 * Deliberately small: no assignees, comments, reminders, or recurrence. When
 * `clientVisible` is true the item may surface as a shared "next step" on the
 * customer reservation workspace (`/reservation/demo`). Internal-only items
 * (the default) never leave the admin surface. See CLAUDE.md → "Session notes
 * / action items".
 */
export type SessionActionItem = {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  status: SessionActionItemStatus;
  /** ISO date (yyyy-mm-dd), optional. */
  dueDate?: string;
  /** When true, may appear as a shared next step on the client reservation workspace. */
  clientVisible?: boolean;
  createdAtISO: string;
  updatedAtISO: string;
};

export type SessionActionItemInput = Omit<
  SessionActionItem,
  "id" | "createdAtISO" | "updatedAtISO"
>;
