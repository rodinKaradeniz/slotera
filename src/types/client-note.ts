/**
 * A single internal note about a client. Separate timestamped entries (not one
 * big textarea) so the operator can keep distinct bits of context: follow-up
 * reminders, preferences, prep details. Admin-only by default — never shown to
 * clients and never surfaced on the customer booking workspace.
 */
export type ClientNote = {
  id: string;
  clientId: string;
  title: string;
  body: string;
  createdAtISO: string;
  updatedAtISO: string;
};

export type ClientNoteInput = {
  clientId: string;
  title: string;
  body: string;
};
