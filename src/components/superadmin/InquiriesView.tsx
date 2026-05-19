"use client";

import * as React from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pill } from "@/components/ui/Pill";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { EmptyState } from "@/components/shared/EmptyState";
import { listInquiries, setInquiryStatus } from "@/services/platform.service";
import { INQUIRY_STATUS, INQUIRY_TYPE } from "@/lib/status-maps";
import { fmtDate } from "@/lib/time";
import type {
  PlatformInquiry,
  PlatformInquiryStatus,
  PlatformInquiryType,
} from "@/types/platform";

const TYPE_OPTIONS: Array<{ value: "" | PlatformInquiryType; label: string }> = [
  { value: "", label: "All types" },
  { value: "business", label: "Business inquiry" },
  { value: "development", label: "Development issue" },
  { value: "feature", label: "Feature request" },
  { value: "general", label: "General request" },
];

const STATUS_OPTIONS: Array<{
  value: "" | PlatformInquiryStatus;
  label: string;
}> = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "resolved", label: "Resolved" },
];

export function InquiriesView() {
  const [items, setItems] = React.useState<PlatformInquiry[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<"" | PlatformInquiryType>("");
  const [status, setStatus] = React.useState<"" | PlatformInquiryStatus>("");

  React.useEffect(() => {
    listInquiries().then(setItems);
  }, []);

  const filtered = React.useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (type && i.type !== type) return false;
      if (status && i.status !== status) return false;
      if (!q) return true;
      return [i.name, i.email, i.message].join(" ").toLowerCase().includes(q);
    });
  }, [items, query, type, status]);

  const updateStatus = async (id: string, s: PlatformInquiryStatus) => {
    await setInquiryStatus(id, s);
    const next = await listInquiries();
    setItems(next);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform"
        title="Inquiries"
        description="Incoming contact/support/business messages. The public contact modal still shows mock success — submissions are not yet stored."
        meta={items ? `${items.length} inquiries` : undefined}
      />

      <div className="grid sm:grid-cols-[1fr_180px_180px] gap-3 mb-4">
        <Input
          icon="search"
          placeholder="Search by name, email, message…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as "" | PlatformInquiryType)}
          options={TYPE_OPTIONS}
        />
        <Select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as "" | PlatformInquiryStatus)
          }
          options={STATUS_OPTIONS}
        />
      </div>

      {!items ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="mail"
          title="No inquiries match"
          body="Try clearing the filters above."
        />
      ) : (
        <Card padded={false}>
          {filtered.map((i) => {
            const sMeta = INQUIRY_STATUS[i.status];
            const tMeta = INQUIRY_TYPE[i.type];
            return (
              <div
                key={i.id}
                className="grid grid-cols-1 md:grid-cols-[1.4fr_2fr_auto] gap-3 md:gap-4 items-start px-5 py-4 border-b border-line-soft last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="text-[14px] text-ink font-medium truncate">
                    {i.name}
                  </div>
                  <div className="text-small truncate">{i.email}</div>
                  <div className="mt-2 inline-flex items-center gap-2 flex-wrap">
                    <Pill tone={tMeta.tone}>{tMeta.label}</Pill>
                    <span className="text-small">
                      {fmtDate(new Date(i.createdAtISO), "short")}
                    </span>
                  </div>
                </div>
                <div className="text-[14px] text-ink-2 leading-relaxed">
                  {truncate(i.message, 180)}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Pill tone={sMeta.tone} icon={sMeta.icon}>
                    {sMeta.label}
                  </Pill>
                  <Select
                    value={i.status}
                    onChange={(e) =>
                      updateStatus(i.id, e.target.value as PlatformInquiryStatus)
                    }
                    options={[
                      { value: "new", label: "New" },
                      { value: "in_review", label: "In review" },
                      { value: "resolved", label: "Resolved" },
                    ]}
                    className="w-40"
                  />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </PageContainer>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}
