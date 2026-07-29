export type WorkspaceSearchKind = "booking" | "client" | "service" | "session";

export type WorkspaceSearchMatch = {
  kind: WorkspaceSearchKind;
  id: string;
  title: string;
  subtitle?: string;
  occurredAtISO?: string;
  keywords: string;
};
