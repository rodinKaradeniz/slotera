"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar, type Crumb } from "./Topbar";
import { CommandPalette } from "@/components/admin/search/CommandPalette";
import { currentSession } from "@/services/auth.service";
import { usePageMeta } from "./PageMeta";
import { useHydrated } from "@/lib/use-hydrated";
import { usePathname } from "next/navigation";
import { exitMs, motion } from "@/lib/motion";
import { usePresence } from "@/lib/use-presence";
import { useScrollLock } from "@/lib/use-scroll-lock";
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
  conversationLayout?: boolean;
};

export function AppShell({
  role,
  nav,
  crumbs,
  topbarRight,
  enableCommandPalette = false,
  conversationLayout = false,
  workspaceLabel,
  userSubtitle,
  children,
}: Props) {
  const { t: uiText } = useI18n();
  const hydrated = useHydrated();
  // null until the user toggles; until then the stored choice applies.
  const [collapsedChoice, setCollapsedChoice] = React.useState<boolean | null>(
    null,
  );
  const collapsed = collapsedChoice ?? (hydrated ? readCollapsed() : true);
  const operator: Operator | null = hydrated
    ? (currentSession()?.operator ?? null)
    : null;
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  // Phones have no room for a rail: the sidebar opens as a sheet over the page instead.
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const sheet = usePresence(sheetOpen, exitMs(motion.sheet));
  useScrollLock(sheetOpen);
  const pathname = usePathname();
  const [sheetPath, setSheetPath] = React.useState(pathname);
  if (sheetPath !== pathname) {
    setSheetPath(pathname);
    setSheetOpen(false);
  }
  React.useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);
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
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSheetOpen((open) => !open);
      return;
    }
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
    <div
      className={
        conversationLayout ? "flex h-dvh overflow-hidden" : "flex min-h-screen"
      }
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-[13px] focus:shadow-3"
      >
        {uiText("ui.skip.to.content")}
      </a>
      <Sidebar
        className="max-md:hidden"
        collapsed={collapsed}
        nav={nav}
        homeHref={homePathForRole(role)}
        eyebrow={eyebrowForRole(role)}
        workspaceLabel={workspace}
        userName={operator?.name}
        userSubtitle={
          userSubtitle ??
          (role === "superadmin" ? uiText("ui.slotera.staff") : operator?.email)
        }
      />
      {sheet.rendered && (
        <div className="md:hidden fixed inset-0 z-40" inert={sheet.closing} aria-hidden={sheet.closing || undefined}>
          <div
            data-state={sheet.state}
            className="drawer-backdrop absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setSheetOpen(false)}
          />
          <div data-state={sheet.state} className="nav-sheet absolute inset-y-0 left-0 shadow-3">
            <Sidebar
              collapsed={false}
              nav={nav}
              homeHref={homePathForRole(role)}
              eyebrow={eyebrowForRole(role)}
              workspaceLabel={workspace}
              userName={operator?.name}
              userSubtitle={
                userSubtitle ??
                (role === "superadmin" ? uiText("ui.slotera.staff") : operator?.email)
              }
              onNavigate={() => setSheetOpen(false)}
            />
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
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
        <main
          id="main"
          tabIndex={-1}
          className={
            conversationLayout
              ? "flex flex-col flex-1 min-h-0 px-4 py-4 outline-none"
              : "flex-1 px-6 py-10 lg:py-12 outline-none"
          }
        >
          {children}
        </main>
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
