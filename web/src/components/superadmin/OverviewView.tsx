"use client";

import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/shared/Stat";
import { Button } from "@/components/ui/Button";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { useToast } from "@/components/ui/Toast";
import { getPlatformOverview } from "@/services/platform.service";
import type { PlatformOverview } from "@/types/platform";

export function OverviewView() {
  const { toast } = useToast();
  const [data, setData] = React.useState<PlatformOverview | null>(null);

  React.useEffect(() => {
    getPlatformOverview()
      .then(setData)
      .catch((error: unknown) =>
        toast.error("Couldn't load the overview", {
          description: error instanceof Error ? error.message : undefined,
        }),
      );
  }, [toast]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform"
        title="Platform overview"
        description="Workspaces, plans, and activity across Slotera."
      />
      {!data ? (
        <LoadingRows count={3} />
      ) : (
        <div className="flex flex-col gap-6">
          <Card padded={false}>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-line-soft">
              <PadStat label="Workspaces" value={data.workspacesTotal} />
              <PadStat label="Active" value={data.workspacesActive} />
              <PadStat label="Suspended" value={data.workspacesSuspended} />
              <PadStat label="Sign-ups · 30 days" value={data.signups30d} />
            </div>
          </Card>
          <Card padded={false}>
            <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-line-soft">
              <PadStat label="Essentials" value={data.workspacesEssentials} />
              <PadStat label="Professional" value={data.workspacesProfessional} />
              <PadStat label="On trial" value={data.workspacesOnTrial} />
              <PadStat label="Bookings · 30 days" value={data.bookings30d} />
              <PadStat label="Unread inquiries" value={data.inquiriesUnread} />
            </div>
          </Card>
          <Card padded={false}>
            <div className="grid grid-cols-2 divide-x divide-line-soft">
              <PadStat label="Emails waiting to send" value={data.emailsPending} />
              <PadStat label="Emails failing" value={data.emailsFailing} />
            </div>
            {data.emailsFailing > 0 && data.emailLastError && (
              <p className="px-5 pb-5 text-small text-danger">
                Latest error: <code>{data.emailLastError}</code>. A 401 means a bad Resend
                key, 403 an unverified sending domain, 422 a rejected address or field.
              </p>
            )}
          </Card>
          <div className="flex flex-wrap gap-2">
            <Link href="/superadmin/workspaces">
              <Button variant="secondary" icon="building">
                Workspaces
              </Button>
            </Link>
            <Link href="/superadmin/inquiries">
              <Button variant="secondary" icon="mail">
                Inquiries
              </Button>
            </Link>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function PadStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-5">
      <Stat label={label} value={String(value)} />
    </div>
  );
}
