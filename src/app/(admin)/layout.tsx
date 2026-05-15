import * as React from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { DrawersProvider } from "@/components/drawers/DrawersProvider";

export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DrawersProvider>{children}</DrawersProvider>
    </AuthGuard>
  );
}
