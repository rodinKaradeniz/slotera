"use client";

import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar, type Crumb } from "./Topbar";
import { CommandPalette } from "@/components/admin/search/CommandPalette";
import { currentSession } from "@/services/auth.service";
import { usePageMeta } from "./PageMeta";
import { useHydrated } from "@/lib/use-hydrated";
import { eyebrowForRole, homePathForRole, type NavItem } from "@/lib/nav";
import type { Operator, UserRole } from "@/types/auth";

const COLLAPSED_KEY = "slotera.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) !== "false";
  } catch {
    return true;
  }
}

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
  const hydrated = useHydrated();
  // null until the user toggles; until then the stored choice applies.
  const [collapsedChoice, setCollapsedChoice] = React.useState<boolean | null>(null);
  const collapsed = collapsedChoice ?? (hydrated ? readCollapsed() : true);
  const operator: Operator | null = hydrated ? (currentSession()?.operator ?? null) : null;
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const meta = usePageMeta();
  const effectiveCrumbs = crumbs ?? meta.crumbs;

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
    const next = !collapsed;
    setCollapsedChoice(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      // ignore
    }
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
