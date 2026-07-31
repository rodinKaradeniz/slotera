import * as React from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { PageMetaProvider } from "@/components/layout/PageMeta";
import { navForRole } from "@/lib/nav";

export default function SuperadminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireRole="superadmin">
      <PageMetaProvider>
        <AppShell role="superadmin" nav={navForRole("superadmin")}>
          {children}
        </AppShell>
      </PageMetaProvider>
    </AuthGuard>
  );
}
