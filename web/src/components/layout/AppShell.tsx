"use client";

import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar, type Crumb } from "./Topbar";
import { CommandPalette } from "@/components/admin/search/CommandPalette";
import { currentSession } from "@/services/auth.service";
import { usePageMeta } from "./PageMeta";
import { eyebrowForRole, homePathForRole, type NavItem } from "@/lib/nav";
import type { Operator, UserRole } from "@/types/auth";

const COLLAPSED_KEY = "slotera.sidebar.collapsed";

type Props = {
  role: UserRole;
  nav: NavItem[];
  crumbs?: Crumb[];
  topbarRight?: React.ReactNode;
  enableCommandPalette?: boolean;
  workspaceLabel?: string;
  userSubtitle?: string;
  children: React.ReactNode;
};

export function AppShell({
  role,
  nav,
  crumbs,
  topbarRight,
  enableCommandPalette = false,
  workspaceLabel,
  userSubtitle,
  children,
}: Props) {
  const [collapsed, setCollapsed] = React.useState(true);
  const [operator, setOperator] = React.useState<Operator | null>(null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const meta = usePageMeta();
  const effectiveCrumbs = crumbs ?? meta.crumbs;

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

  React.useEffect(() => {
    if (!enableCommandPalette) return;
    const onKey = (e: KeyboardEvent) => {
      const isShortcut =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isShortcut) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableCommandPalette]);

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

  const workspace =
    workspaceLabel ??
    (role === "superadmin" ? "Slotera HQ" : operator?.workspaceName);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={collapsed}
        nav={nav}
        homeHref={homePathForRole(role)}
        eyebrow={eyebrowForRole(role)}
        workspaceLabel={workspace}
        userName={operator?.name}
        userSubtitle={
          userSubtitle ??
          (role === "superadmin" ? "Slotera staff" : "Online · Berlin")
        }
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          collapsed={collapsed}
          onToggleSidebar={toggle}
          onOpenPalette={
            enableCommandPalette ? () => setPaletteOpen(true) : undefined
          }
          crumbs={effectiveCrumbs}
          right={topbarRight}
          showSearch={enableCommandPalette}
        />
        <main className="flex-1 px-6 py-10 lg:py-12">{children}</main>
      </div>
      {enableCommandPalette && (
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
