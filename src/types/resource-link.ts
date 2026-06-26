export type ResourceKind = "guide" | "worksheet" | "document" | "link";

/**
 * A lightweight shared resource a provider attaches to a session — a worksheet,
 * a prep guide, a follow-up checklist, or an external link. Phase 1 is
 * display-only/mock: there are no uploads, no file storage, no permissions
 * model, and no backend. `url` is a placeholder (`#`) in the demo.
 *
 * When `clientVisible` is true the resource may surface in the "Shared
 * resources" section of the customer reservation workspace
 * (`/reservation/demo`). Future production may attach resources to services,
 * sessions, or packages. See CLAUDE.md → "Resources".
 */
export type ResourceLink = {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  url: string;
  kind?: ResourceKind;
  clientVisible: boolean;
  createdAtISO: string;
};
