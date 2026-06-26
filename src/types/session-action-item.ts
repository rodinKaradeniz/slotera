export type SessionActionItemStatus = "todo" | "done";

/**
 * A lightweight admin task attached to a session — pre/post-session prep the
 * operator wants to track (e.g. "Send proposal summary", "Share prep checklist").
 *
 * Deliberately small: no assignees, comments, reminders, or recurrence.
 * `clientVisible` is retained for a future customer-facing surface; today these
 * items live admin-side only (the customer booking workspace does not show
 * them). Internal-only items (the default) never leave the admin surface. See
 * CLAUDE.md → "Session notes / action items".
 */
export type SessionActionItem = {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  status: SessionActionItemStatus;
  /** ISO date (yyyy-mm-dd), optional. */
  dueDate?: string;
  /** When true, the item is eligible for a future client-facing surface (admin-only today). */
  clientVisible?: boolean;
  createdAtISO: string;
  updatedAtISO: string;
};

export type SessionActionItemInput = Omit<
  SessionActionItem,
  "id" | "createdAtISO" | "updatedAtISO"
>;
