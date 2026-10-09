import * as React from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { PageMetaProvider } from "@/components/layout/PageMeta";
import { navForRole } from "@/lib/nav";
import { dataSource } from "@/lib/env";
import { notFound } from "next/navigation";

export default function SuperadminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The platform area is staff-only and exists only in the real app; the mock
  // demo is a prospect showcase and never exposes it.
  if (dataSource === "mock") notFound();
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
