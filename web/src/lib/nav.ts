import type { IconName } from "@/components/ui/Icon";
import type { UserRole } from "@/types/auth";
import { dataSource } from "@/lib/env";
import { readSession } from "@/lib/session";

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
};

export const OPERATOR_NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid",      href: "/admin/dashboard" },
  { id: "calendar",  label: "Calendar",  icon: "calendar",  href: "/admin/calendar" },
  { id: "bookings",  label: "Bookings",  icon: "clipboard", href: "/admin/bookings" },
  { id: "clients",   label: "Clients",   icon: "users",     href: "/admin/clients" },
  { id: "services",  label: "Services",  icon: "layers",    href: "/admin/services" },
  { id: "packages",  label: "Packages",  icon: "package",   href: "/admin/packages" },
  { id: "forms",     label: "Forms",     icon: "file",      href: "/admin/forms" },
  { id: "settings",  label: "Settings",  icon: "cog",       href: "/admin/settings" },
];

export const API_OPERATOR_NAV: NavItem[] = OPERATOR_NAV.filter((item) =>
  ["dashboard", "calendar", "bookings", "clients", "services", "forms", "settings"].includes(item.id),
);

export const SUPERADMIN_NAV: NavItem[] = [
  { id: "overview",      label: "Overview",      icon: "grid",     href: "/superadmin/overview" },
  { id: "workspaces",    label: "Workspaces",    icon: "building", href: "/superadmin/workspaces" },
  { id: "inquiries",     label: "Inquiries",     icon: "mail",     href: "/superadmin/inquiries" },
];

// The platform area exists only in the real app, so both lists are the same.
export const API_SUPERADMIN_NAV: NavItem[] = SUPERADMIN_NAV;

export function navForRole(role: UserRole): NavItem[] {
  if (role === "superadmin") {
    return dataSource === "api" ? API_SUPERADMIN_NAV : SUPERADMIN_NAV;
  }
  return dataSource === "api" ? API_OPERATOR_NAV : OPERATOR_NAV;
}

export function homePathForRole(role: UserRole): string {
  if (role === "superadmin") return "/superadmin/overview";
  return "/admin/dashboard";
}

export function eyebrowForRole(role: UserRole): string {
  return role === "superadmin" ? "Platform" : "Workspace";
}

/** Where "view my booking page" links go: the demo flow, or the workspace's real page. */
export function bookingPageHref(): string {
  if (dataSource === "mock") return "/booking";
  const slug = readSession()?.operator.workspaceSlug;
  return slug ? `/book/${slug}` : "/admin/settings";
}
