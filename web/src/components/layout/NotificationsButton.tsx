"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { DATA_CHANGED } from "@/api/query-cache";
import { getNotificationSummary, markAllRead } from "@/services/notifications.service";
import type { Notification } from "@/types/notification";
import { motion } from "@/lib/motion";
import { usePresence } from "@/lib/use-presence";

export function NotificationsButton() {
  const { t: uiText, lang } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Notification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const panel = usePresence(open, motion.popover.out);

  React.useEffect(() => {
    let live = true;
    const load = () => getNotificationSummary().then((page) => {
      if (live) {setItems(page.items); setUnread(page.unreadCount); setHasMore(page.hasMore); setError(null);}
    }).catch((cause: unknown) => {if (live) setError(cause instanceof Error ? cause.message : String(cause));});
    void load();
    window.addEventListener(DATA_CHANGED, load);
    return () => {live = false; window.removeEventListener(DATA_CHANGED, load);};
  }, [lang]);

  React.useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("slotera-open-notifications",show);
    return () => window.removeEventListener("slotera-open-notifications",show);
  }, []);
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);


  const handleMarkAll = async () => {
    try {
      await markAllRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : uiText("ui.notifications.could.not.be.updated"));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-11 h-11 md:w-9 md:h-9 rounded-md hover:bg-paper-2 text-ink-2 flex items-center justify-center"
        aria-label={uiText("ui.notifications")}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
        )}
      </button>
      {panel.rendered && (
        <div
          data-state={panel.state}
          inert={panel.closing}
          aria-hidden={panel.closing || undefined}
          className="popover origin-top-right absolute right-0 mt-2 w-[340px] bg-surface border border-line rounded-lg shadow-3 overflow-hidden z-30"
        >
          <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between">
            <div className="font-serif text-ink" style={{ fontSize: 16 }}>
              {uiText("ui.notifications")}</div>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[12px] text-ink-3 hover:text-ink"
              >
                {uiText("ui.mark.all.read")}</button>
            )}
          </div>
          <div className="list-rise max-h-[min(28rem,70vh)] overflow-y-auto">
            {error ? (
              <div className="p-6 text-small text-center text-danger">{error}</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-small text-center">{uiText("ui.no.notifications")}</div>
            ) : (
              items.map((n) => (
                <NotificationRow key={n.id} item={n} compact onNavigate={() => setOpen(false)} />
              ))
            )}
          </div>
          <Link
            href="/admin/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-4 py-2.5 border-t border-line-soft text-[13px] font-medium text-ink-2 hover:bg-paper-2 hover:text-ink transition-colors duration-(--d-press) ease-out"
          >
            {hasMore ? uiText("notifications.see.all") : uiText("notifications.open.page")}
            <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
