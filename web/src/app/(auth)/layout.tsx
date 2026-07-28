"use client";

import { usePathname } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";

export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const size = pathname.startsWith("/onboarding")
    ? "wide"
    : pathname.startsWith("/register")
      ? "medium"
      : "default";
  return <AuthShell size={size}>{children}</AuthShell>;
}
