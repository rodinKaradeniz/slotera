"use client";

import * as React from "react";
import { Icon } from "@/components/ui/Icon";
import { NotificationsButton } from "./NotificationsButton";
import { NavbarSearch } from "@/components/admin/search/NavbarSearch";
import { cn } from "@/lib/cn";

export type Crumb = { label: string; href?: string };

type Props = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenPalette?: () => void;
  crumbs?: Crumb[];
  right?: React.ReactNode;
  /** Show the operator command palette search input. */
  showSearch?: boolean;
  /** Show notifications bell. */
  showNotifications?: boolean;
};

export function Topbar({
  collapsed,
  onToggleSidebar,
  onOpenPalette,
  crumbs = [],
  right,
  showSearch = false,
  showNotifications = true,
}: Props) {
  return (
    <header className="h-16 sticky top-0 z-20 bg-paper/85 backdrop-blur border-b border-line-soft flex items-center px-4 gap-3">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="w-9 h-9 rounded-md hover:bg-paper-2 text-ink-2 flex items-center justify-center"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <Icon name="panel-l" size={18} />
      </button>

      <nav className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden text-[13px]">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <Icon name="chevron-r" size={14} className="text-ink-4" />
            )}
            {c.href && i < crumbs.length - 1 ? (
              <a
                href={c.href}
                className="text-ink-3 hover:text-ink truncate"
              >
                {c.label}
              </a>
            ) : (
              <span
                className={cn(
                  "truncate",
                  i === crumbs.length - 1
                    ? "text-ink font-medium"
                    : "text-ink-3",
                )}
              >
                {c.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {showSearch && onOpenPalette && (
        <NavbarSearch onOpenPalette={onOpenPalette} />
      )}

      {right}
      {showNotifications && <NotificationsButton />}
    </header>
  );
}
