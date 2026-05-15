"use client";

import * as React from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar, type Crumb } from "./AdminTopbar";
import { currentSession } from "@/services/auth.service";
import type { Operator } from "@/types/auth";

const COLLAPSED_KEY = "slotera.sidebar.collapsed";

type Props = {
  crumbs?: Crumb[];
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
};

export function AdminShell({ crumbs, topbarRight, children }: Props) {
  const [collapsed, setCollapsed] = React.useState(true);
  const [operator, setOperator] = React.useState<Operator | null>(null);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
    const s = currentSession();
    setOperator(s?.operator ?? null);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        collapsed={collapsed}
        operatorName={operator?.name}
        workspaceName={operator?.workspaceName}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          collapsed={collapsed}
          onToggleSidebar={toggle}
          crumbs={crumbs}
          right={topbarRight}
        />
        <main className="flex-1 px-6 py-8 fade-in">{children}</main>
      </div>
    </div>
  );
}
