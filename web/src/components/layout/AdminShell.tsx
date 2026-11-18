"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";
import type { Crumb } from "./Topbar";
import { navForRole } from "@/lib/nav";

type Props = {
  crumbs?: Crumb[];
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
};

export function AdminShell({ crumbs, topbarRight, children }: Props) {
  const pathname = usePathname();
  return (
    <AppShell
      conversationLayout={
        pathname === "/admin/assistant" || pathname === "/admin/messages"
      }
      role="operator_admin"
      nav={navForRole("operator_admin")}
      crumbs={crumbs}
      topbarRight={topbarRight}
      enableCommandPalette
    >
      {children}
    </AppShell>
  );
}
