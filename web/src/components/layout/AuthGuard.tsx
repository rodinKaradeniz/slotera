"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { restoreSession } from "@/services/auth.service";
import { homePathForRole, isNavRoute } from "@/lib/nav";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UserRole } from "@/types/auth";
import { dataSource } from "@/lib/env";

type Props = {
  children: React.ReactNode;
  /** When set, the guard also requires the session role to match. */
  requireRole?: UserRole;
};

export function AuthGuard({ children, requireRole }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          const next = encodeURIComponent(pathname || "/admin/dashboard");
          router.replace(`/login?next=${next}`);
          return;
        }
        if (requireRole && session.role !== requireRole) {
          router.replace(homePathForRole(session.role));
          return;
        }
        // API mode exposes only the routes its navigation lists; anything else
        // (still mock-only) goes home. Deriving this from the nav keeps the
        // guard and the sidebar from disagreeing.
        if (dataSource === "api" && requireRole && !isNavRoute(requireRole, pathname)) {
          router.replace(homePathForRole(requireRole));
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router, pathname, requireRole]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="flex flex-col gap-3 w-72">
          <Skeleton h={28} />
          <Skeleton h={20} />
          <Skeleton h={20} w="60%" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
