import * as React from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { DrawersProvider } from "@/components/drawers/DrawersProvider";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageMetaProvider } from "@/components/layout/PageMeta";

export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DrawersProvider>
        <PageMetaProvider>
          <AdminShell>{children}</AdminShell>
        </PageMetaProvider>
      </DrawersProvider>
    </AuthGuard>
  );
}
