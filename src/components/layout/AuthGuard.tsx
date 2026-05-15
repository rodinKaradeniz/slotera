"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { currentSession } from "@/services/auth.service";
import { Skeleton } from "@/components/ui/Skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
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
    setReady(true);
  }, [router, pathname]);

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
