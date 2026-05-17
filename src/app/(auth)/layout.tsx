"use client";

import { usePathname } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";

export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const wide = pathname?.startsWith("/onboarding") ?? false;
  return <AuthShell wide={wide}>{children}</AuthShell>;
}
