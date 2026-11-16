"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import Link from "next/link";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { getSession } from "@/services/sessions.service";
import { useToast } from "@/components/ui/Toast";
import { SessionActionItems } from "@/components/drawers/SessionActionItems";
import { listWorklistPage } from "@/services/session-action-items.service";
import { useLoad } from "@/lib/use-load";
import { LoadError } from "@/components/shared/LoadError";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { PendingAction } from "@/types/dashboard";
import { cn } from "@/lib/cn";

type Props = { items: PendingAction[] };

export function PendingActions({ items }: Props) {
  const { t: uiText } = useI18n();
  const drawers = useDrawers();
  const { toast } = useToast();
  const openSession = async (id: string) => {
    try {
      const session = await getSession(id);
      if (session) drawers.openSessionDrawer({ initial: session });
      else tasks.reload();
    } catch {
      toast.error(uiText("client.failed"));
    }
  };
  const [offset, setOffset] = React.useState(0);
  const [status, setStatus] = React.useState<"todo" | "done">("todo");
  const load = React.useCallback(
    (signal?: AbortSignal) => listWorklistPage(status, offset, signal),
    [offset, status],
  );
  const tasks = useLoad(load);
  const list =
    tasks.data?.actions ??
    (status === "done"
      ? []
      : items.filter(
          (item) =>
            item.id !== "action-items-pending" &&
            item.id !== "open-action-items",
        ));
  const destination = (id: string) =>
    id === "billing"
      ? "/admin/settings?section=billing"
      : id.includes("notification")
        ? "/admin/settings"
        : id.includes("message")
          ? "/admin/messages"
          : "/admin/calendar";
  return (
    <Card padded={false} className="h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-line-soft">
        <div>
          <div className="eyebrow mb-1">{uiText("todo.title")}</div>
          <div
            className="font-serif text-ink"
            style={{ fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em" }}
          >
            {(tasks.data?.total ?? 0) + list.length}{" "}
            {uiText(status === "todo" ? "ui.pending" : "todo.completed")}
          </div>
        </div>
        <button
          type="button"
          onClick={tasks.reload}
          aria-label={uiText("ui.refresh")}
          className="text-ink-3 hover:text-ink w-7 h-7 rounded-md flex items-center justify-center"
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <div className="flex gap-2 px-6 py-3">
        {(["todo", "done"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "secondary" : "ghost"}
            onClick={() => {
              setStatus(value);
              setOffset(0);
            }}
          >
            {uiText(value === "todo" ? "todo.open" : "todo.completed")}
          </Button>
        ))}
      </div>
      <div className="flex-1">
        {list.length === 0 && tasks.data?.total === 0 && (
          <div className="px-5 py-6 text-small text-center">
            {uiText("ui.all.caught.up")}
          </div>
        )}
        {list.map((p) => (
          <Link
            href={destination(p.id)}
            onClick={(event) => {
              if (p.id.includes("notification")) {
                event.preventDefault();
                window.dispatchEvent(new Event("slotera-open-notifications"));
              }
            }}
            key={p.id}
            className="flex items-start gap-3 px-6 py-4 border-b border-line-soft last:border-b-0"
          >
            <span
              className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
                p.tone === "warning" && "bg-[#F4E9D6] text-warning",
                p.tone === "info" && "bg-[#E1E7EE] text-info",
                p.tone === "danger" && "bg-[#F2DDD8] text-danger",
                p.tone === "accent" && "bg-accent-soft text-accent",
                (p.tone === "neutral" ||
                  !["warning", "info", "danger", "accent"].includes(p.tone)) &&
                  "bg-paper-2 text-ink-2",
              )}
            >
              <Icon name={p.icon} size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-ink">{p.label}</div>
              <div className="text-small truncate">{p.detail}</div>
            </div>
            <div className="text-micro text-ink-3 flex-shrink-0">{p.age}</div>
          </Link>
        ))}
        <div className="px-6 py-4">
          {tasks.error && (
            <LoadError message={tasks.error} onRetry={tasks.reload} />
          )}
          <SessionActionItems
            allowCreate={status === "todo"}
            onOpenSession={openSession}
            items={tasks.data?.items ?? []}
            loading={!tasks.data}
            onChange={() => tasks.reload()}
          />
          <div className="flex justify-between mt-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 25))}
            >
              {uiText("todo.previous")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!tasks.data || offset + 25 >= tasks.data.total}
              onClick={() => setOffset(offset + 25)}
            >
              {uiText("todo.next")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
