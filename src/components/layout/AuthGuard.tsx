"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { currentSession } from "@/services/auth.service";
import { homePathForRole } from "@/lib/nav";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UserRole } from "@/types/auth";

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
    const session = currentSession();
    if (!session) {
      const next = encodeURIComponent(pathname || "/admin/dashboard");
      router.replace(`/login?next=${next}`);
      return;
    }
    if (requireRole && session.role !== requireRole) {
      router.replace(homePathForRole(session.role));
      return;
    }
    setReady(true);
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
