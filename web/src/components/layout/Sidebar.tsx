"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { ContactModal } from "@/components/public/ContactModal";
import { useI18n } from "@/components/i18n/I18nProvider";
import { logout } from "@/services/auth.service";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/nav";

type Props = {
  collapsed: boolean;
  nav: NavItem[];
  homeHref: string;
  eyebrow: string;
  workspaceLabel?: string;
  userName?: string;
  userSubtitle?: string;
};

export function Sidebar({
  collapsed,
  nav,
  homeHref,
  eyebrow,
  workspaceLabel,
  userName,
  userSubtitle,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <>
    <aside
      className={cn(
        "h-screen sticky top-0 bg-surface-warm border-r border-line flex flex-col flex-shrink-0 transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[244px]",
      )}
    >
      <div
        className={cn(
          "h-16 flex items-center border-b border-line-soft px-3",
          collapsed && "justify-center",
        )}
      >
        <Logo withWord={!collapsed} href={homeHref} />
      </div>

      {!collapsed && (
        <div className="px-3 pt-4 pb-2">
          <div className="eyebrow">{eyebrow}</div>
          <div className="text-[14px] font-medium text-ink mt-0.5 truncate">
            {workspaceLabel ?? "Slotera"}
          </div>
        </div>
      )}

      <nav className="flex-1 px-2 py-2 flex flex-col gap-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const label = t(`nav.${item.id}` as Parameters<typeof t>[0]);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 h-10 rounded-md transition-colors",
                collapsed ? "justify-center px-2" : "px-3",
                active
                  ? "bg-accent-soft text-accent-ink"
                  : "text-ink-2 hover:bg-paper-2",
              )}
              title={collapsed ? label : undefined}
            >
              <Icon name={item.icon} size={18} />
              {!collapsed && <span className="text-[14px]">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div
        ref={menuRef}
        className={cn(
          "relative border-t border-line-soft p-3 flex items-center gap-3",
          collapsed && "justify-center",
        )}
      >
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-ink truncate">
              {userName ?? "Operator"}
            </div>
            <div className="text-micro truncate">
              {userSubtitle ?? "Online · Berlin"}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 rounded-md hover:bg-paper-2 text-ink-3 flex items-center justify-center"
          aria-label="Account menu"
        >
          <Icon name="more" size={18} />
        </button>
        {menuOpen && (
          <div
            className={cn(
              "absolute bottom-full left-2 right-2 mb-2 bg-surface border border-line rounded-md shadow-2 py-1 fade-in z-10",
              collapsed && "left-2 right-auto w-44",
            )}
          >
            <Link
              href="/booking"
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-paper-2"
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="eye" size={14} /> View page
            </Link>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-paper-2 text-left"
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
            >
              <Icon name="alert" size={14} /> Report a problem
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-paper-2 text-left text-danger"
              onClick={handleLogout}
            >
              <Icon name="power" size={14} /> Logout
            </button>
          </div>
        )}
      </div>
    </aside>
    <ContactModal
      open={reportOpen}
      onClose={() => setReportOpen(false)}
      persist
      defaultReason="development"
      eyebrow="Operator workspace"
      title="Report a problem"
      description="Spotted a bug or a broken flow? Send us a note — we'll take a look."
    />
    </>
  );
}
