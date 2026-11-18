"use client";
import { DATA_CHANGED } from "@/api/query-cache";
import { translateInterfaceLabel } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { EmptyState } from "@/components/shared/EmptyState";
import { NewWorkspaceDrawer } from "./NewWorkspaceDrawer";
import { Pagination } from "@/components/shared/Pagination";
import { LoadError } from "@/components/shared/LoadError";
import { listInquiryPage, setInquiryRead } from "@/services/platform.service";
import { INQUIRY_TYPE } from "@/lib/status-maps";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { PlatformInquiry, PlatformInquiryType } from "@/types/platform";

/* ──────────────────────────────────────────────────────────────────────────
   Inquiries inbox.
   Slim, mailbox-style rows: unread inquiries carry a subtle warm tint and a
   small accent dot; read ones recede. Clicking a row opens the preview modal
   which auto-marks read on open and exposes the workspace-promotion action
   for business-type inquiries.
   ────────────────────────────────────────────────────────────────────────── */

const TYPE_OPTIONS: Array<{ value: "" | PlatformInquiryType; label: string }> =
  [
    { value: "", label: "All types" },
    { value: "business", label: "Business inquiry" },
    { value: "pilot", label: "Pilot application" },
    { value: "development", label: "Development issue" },
    { value: "feature", label: "Feature request" },
    { value: "general", label: "General request" },
  ];

const READ_OPTIONS: Array<{ value: "" | "unread" | "read"; label: string }> = [
  { value: "", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

export function InquiriesView() {
  const { t: uiText, lang: labelLang } = useI18n();
  const router = useRouter();
  const [items, setItems] = React.useState<PlatformInquiry[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<"" | PlatformInquiryType>("");
  const [readFilter, setReadFilter] = React.useState<"" | "unread" | "read">(
    "",
  );
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [promoting, setPromoting] = React.useState<PlatformInquiry | null>(
    null,
  );

  const [offset, setOffset] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => window.removeEventListener(DATA_CHANGED, refresh);
  }, []);
  React.useEffect(() => {
    let live = true;
    const controller = new AbortController();
    listInquiryPage({search: query, reason: type, read: readFilter, offset}, controller.signal).then((page) => {
      if (live) { setItems(page.items); setTotal(page.total); setError(null); }
    }).catch((error: unknown) => { if (live) setError(error instanceof Error ? error.message : String(error)); });
    return () => {live = false; controller.abort();};
  }, [query, type, readFilter, offset, attempt]);
  const filtered = items ?? [];

  const openInquiry = items?.find((i) => i.id === openId) ?? null;

  const handleOpen = async (i: PlatformInquiry) => {
    setOpenId(i.id);
    // Auto-mark read when the preview opens. Skip the round-trip if it was
    // already read — keeps the inbox count tidy.
    if (!i.read) {
      const next = await setInquiryRead(i.id, true);
      setItems(
        (curr) => curr?.map((x) => (x.id === next.id ? next : x)) ?? null,
      );
    }
  };

  const handleMarkUnread = async () => {
    if (!openInquiry) return;
    const next = await setInquiryRead(openInquiry.id, false);
    setItems((curr) => curr?.map((x) => (x.id === next.id ? next : x)) ?? null);
    setOpenId(null);
  };

  return (
    <PageContainer>
      <PageHeader
        title={uiText("ui.inquiries")}
        description={uiText("ui.incoming.contact.support.and.business.messages.pro.upgrade.requests.from.operators.land.he")}
        meta={
          items ? String(total) : undefined
        }
      />

      <div className="grid sm:grid-cols-[1fr_180px_140px] gap-3 mb-4">
        <Input
          icon="search"
          placeholder={uiText("ui.search.by.name.email.message")}
          value={query}
          onChange={(e) => {setQuery(e.target.value); setOffset(0);}}
        />
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as "" | PlatformInquiryType)}
          options={TYPE_OPTIONS.map((option) => ({ ...option, label: translateInterfaceLabel(labelLang, option.label) }))}
        />
        <Select
          value={readFilter}
          onChange={(e) =>
            setReadFilter(e.target.value as "" | "unread" | "read")
          }
          options={READ_OPTIONS}
        />
      </div>

      {!items ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="mail"
          title={uiText("ui.no.inquiries.match")}
          body="Try clearing the filters above."
        />
      ) : (
        <Card padded={false} className="list-rise">
          {filtered.map((i) => (
            <InquiryRow key={i.id} inquiry={i} onClick={() => handleOpen(i)} />
          ))}
        </Card>
      )}

      <InquiryPreviewModal
        inquiry={openInquiry}
        onClose={() => setOpenId(null)}
        onMarkUnread={handleMarkUnread}
        onPromote={(i) => {
          setOpenId(null);
          setPromoting(i);
        }}
      />

      <NewWorkspaceDrawer
        open={promoting !== null}
        onClose={() => setPromoting(null)}
        fromInquiryId={promoting?.id}
        initial={
          promoting
            ? {
                name: promoting.company ?? undefined,
                ownerName: promoting.name,
                ownerEmail: promoting.email,
              }
            : undefined
        }
        onCreated={async (ws) => {
          setAttempt((value) => value + 1);
          router.push(`/superadmin/workspaces/${ws.id}`);
        }}
      />
      {error && <LoadError message={error} onRetry={() => setAttempt((value) => value + 1)} />}
      <Pagination total={total} offset={offset} onChange={setOffset} />
    </PageContainer>
  );
}

/* ── row ────────────────────────────────────────────────────────────────── */

function InquiryRow({
  inquiry,
  onClick,
}: {
  inquiry: PlatformInquiry;
  onClick: () => void;
}) {
  const { lang: labelLang } = useI18n();
  const tMeta = INQUIRY_TYPE[inquiry.type];
  const unread = !inquiry.read;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full grid items-center text-left transition-colors",
        // Columns: dot | name+email | type | message | date
        // Name column is capped (not fr-greedy) so the type pill stays anchored
        // next to the sender info — base gap is tight, the message cell carries
        // its own horizontal padding to widen the visual breathing room around it.
        "grid-cols-[14px_minmax(180px,220px)_auto_minmax(0,1fr)_auto] gap-x-3",
        "px-4 py-2.5 border-b border-line-soft last:border-b-0",
        unread ? "bg-surface-warm hover:bg-paper-2" : "hover:bg-surface-warm",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "w-2 h-2 rounded-full",
          unread ? "bg-accent" : "bg-transparent",
        )}
      />
      <div className="min-w-0">
        <div
          className={cn(
            "text-[14px] truncate",
            unread ? "font-medium text-ink" : "text-ink-2",
          )}
        >
          {inquiry.name}
        </div>
        <div className="text-micro text-ink-3 truncate hidden sm:block">
          {inquiry.email}
        </div>
      </div>
      <Pill tone={tMeta.tone}>{translateInterfaceLabel(labelLang, tMeta.label)}</Pill>
      <div
        className={cn(
          // Wider left padding pushes the message away from the type pill;
          // max-w caps how far the message can stretch on wide screens so it
          // doesn't crowd the date column on the right.
          "text-[13px] truncate hidden md:block pl-12 pr-4 max-w-[560px]",
          unread ? "text-ink-2" : "text-ink-3",
        )}
      >
        {inquiry.message}
      </div>
      <div className="text-micro text-ink-3 whitespace-nowrap">
        {fmtDate(new Date(inquiry.createdAtISO), "short")}
      </div>
    </button>
  );
}

/* ── preview modal ──────────────────────────────────────────────────────── */

function InquiryPreviewModal({
  inquiry,
  onClose,
  onMarkUnread,
  onPromote,
}: {
  inquiry: PlatformInquiry | null;
  onClose: () => void;
  onMarkUnread: () => void;
  onPromote: (i: PlatformInquiry) => void;
}) {
  const { t: uiText, lang: labelLang } = useI18n();
  if (!inquiry) {
    return (
      <Modal open={false} onClose={onClose} title="">
        {null}
      </Modal>
    );
  }
  const tMeta = INQUIRY_TYPE[inquiry.type];
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={
        <span className="block">
          <span className="eyebrow block mb-2">{uiText("ui.inquiry")}</span>
          <span
            className="block font-serif text-ink"
            style={{
              fontSize: 26,
              fontWeight: 380,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
            }}
          >
            {inquiry.name}
          </span>
          <span className="flex items-center gap-2 mt-2 text-small text-ink-3">
            <a
              href={`mailto:${inquiry.email}`}
              className="text-ink-2 hover:text-ink underline"
              onClick={(e) => e.stopPropagation()}
            >
              {inquiry.email}
            </a>
            <span aria-hidden>·</span>
            <Pill tone={tMeta.tone}>{translateInterfaceLabel(labelLang, tMeta.label)}</Pill>
            <span aria-hidden>·</span>
            <span>{fmtDate(new Date(inquiry.createdAtISO))}</span>
          </span>
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onMarkUnread}>
            {uiText("ui.mark.unread")}</Button>
          <Button variant="ghost" onClick={onClose}>
            {uiText("ui.close")}</Button>
          {(inquiry.type === "business" || inquiry.type === "pilot") && (
            <Button
              variant="primary"
              icon="building"
              onClick={() => onPromote(inquiry)}
            >
              {uiText("ui.promote.to.workspace")}</Button>
          )}
        </>
      }
    >
      <div className="rounded-md border border-line-soft bg-surface-warm px-4 py-3">
        <p className="text-body text-ink whitespace-pre-wrap">
          {inquiry.message}
        </p>
      </div>
    </Modal>
  );
}
