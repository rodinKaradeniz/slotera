export type SessionActionItemStatus = "todo" | "done";

/** Private operator preparation and follow-up tasks; never exposed to clients. */
export type SessionActionItem = {
  version?: number;
  id: string;
  sessionId?: string;
  title: string;
  description?: string;
  status: SessionActionItemStatus;
  /** ISO date (yyyy-mm-dd), optional. */
  dueDate?: string;
  createdAtISO: string;
  updatedAtISO: string;
};

export type SessionActionItemInput = Omit<
  SessionActionItem,
  "id" | "createdAtISO" | "updatedAtISO"
>;
