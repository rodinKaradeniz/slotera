"use client";

import { notFound, usePathname } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { dataSource } from "@/lib/env";

// Account flows exist only in the real app. The mock demo is a showcase for
// prospects, so these routes 404 there (docs/PRODUCT.md → Phase scope).
const APP_ONLY_PREFIXES = ["/register", "/onboarding", "/forgot-password", "/reset-password"];

export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  if (dataSource === "mock" && APP_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    notFound();
  }
  const size = pathname.startsWith("/onboarding")
    ? "wide"
    : pathname.startsWith("/register")
      ? "medium"
      : "default";
  return <AuthShell size={size}>{children}</AuthShell>;
}
