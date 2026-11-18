"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [data, setData] = React.useState<PlatformOverview | null>(null);

  React.useEffect(() => {
    getPlatformOverview()
      .then(setData)
      .catch((error: unknown) =>
        toast.error(uiText("ui.couldn.t.load.the.overview"), {
          description: error instanceof Error ? error.message : undefined,
        }),
      );
  }, [toast, uiText]);

  return (
    <PageContainer>
      <PageHeader
        title={uiText("ui.platform.overview")}
        description={uiText("ui.workspaces.plans.and.activity.across.slotera")}
      />
      {!data ? (
        <LoadingRows count={3} />
      ) : (
        <div className="flex flex-col gap-6">
          <Card padded={false}>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-line-soft">
              <PadStat label={uiText("ui.workspaces")} value={data.workspacesTotal} />
              <PadStat label={uiText("ui.active")} value={data.workspacesActive} />
              <PadStat label={uiText("ui.suspended")} value={data.workspacesSuspended} />
              <PadStat label={uiText("ui.sign.ups.30.days")} value={data.signups30d} />
            </div>
          </Card>
          <Card padded={false}>
            <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-line-soft">
              <PadStat label="Essentials" value={data.workspacesEssentials} />
              <PadStat label="Professional" value={data.workspacesProfessional} />
              <PadStat label={uiText("ui.on.trial")} value={data.workspacesOnTrial} />
              <PadStat label={uiText("ui.bookings.30.days")} value={data.bookings30d} />
              <PadStat label={uiText("ui.unread.inquiries")} value={data.inquiriesUnread} />
            </div>
          </Card>
          <Card padded={false}>
            <div className="grid grid-cols-2 divide-x divide-line-soft">
              <PadStat label={uiText("ui.emails.waiting.to.send")} value={data.emailsPending} />
              <PadStat label={uiText("ui.emails.failing")} value={data.emailsFailing} />
            </div>
            {data.emailsFailing > 0 && data.emailLastError && (
              <p className="px-5 pb-5 text-small text-danger">
                {uiText("ui.latest.error")}<code>{data.emailLastError}</code>{uiText("ui.a.401.means.a.bad.resend.key.403.an.unverified.sending.domain.422.a.rejected.address.or.fi")}</p>
            )}
          </Card>
          <div className="flex flex-wrap gap-2">
            <Link href="/superadmin/workspaces">
              <Button variant="secondary" icon="building">
                {uiText("ui.workspaces")}</Button>
            </Link>
            <Link href="/superadmin/inquiries">
              <Button variant="secondary" icon="mail">
                {uiText("ui.inquiries")}</Button>
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
