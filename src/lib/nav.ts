import type { IconName } from "@/components/ui/Icon";
import type { UserRole } from "@/types/auth";

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
  { id: "settings",  label: "Settings",  icon: "cog",       href: "/admin/settings" },
];

export const SUPERADMIN_NAV: NavItem[] = [
  { id: "overview",      label: "Overview",      icon: "grid",     href: "/superadmin/overview" },
  { id: "workspaces",    label: "Workspaces",    icon: "building", href: "/superadmin/workspaces" },
  { id: "subscriptions", label: "Subscriptions", icon: "card",     href: "/superadmin/subscriptions" },
  { id: "inquiries",     label: "Inquiries",     icon: "mail",     href: "/superadmin/inquiries" },
  { id: "settings",      label: "Settings",      icon: "cog",      href: "/superadmin/settings" },
];

export function navForRole(role: UserRole): NavItem[] {
  return role === "superadmin" ? SUPERADMIN_NAV : OPERATOR_NAV;
}

export function homePathForRole(role: UserRole): string {
  return role === "superadmin" ? "/superadmin/overview" : "/admin/dashboard";
}

export function eyebrowForRole(role: UserRole): string {
  return role === "superadmin" ? "Platform" : "Workspace";
}
