"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { DATA_CHANGED } from "@/api/query-cache";
import { getNotificationSummary, markAllRead } from "@/services/notifications.service";
import type { Notification } from "@/types/notification";
import { cn } from "@/lib/cn";

export function NotificationsButton() {
  const { t: uiText, lang } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Notification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let live = true;
    const load = () => getNotificationSummary().then((page) => {
      if (live) {setItems(page.items); setUnread(page.unreadCount); setError(null);}
    }).catch((cause: unknown) => {if (live) setError(cause instanceof Error ? cause.message : String(cause));});
    void load();
    window.addEventListener(DATA_CHANGED, load);
    return () => {live = false; window.removeEventListener(DATA_CHANGED, load);};
  }, [lang]);

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
        className="relative w-9 h-9 rounded-md hover:bg-paper-2 text-ink-2 flex items-center justify-center"
        aria-label={uiText("ui.notifications")}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] bg-surface border border-line rounded-lg shadow-3 overflow-hidden fade-in z-30">
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
          <div className="max-h-96 overflow-y-auto">
            {error ? (
              <div className="p-6 text-small text-center text-danger">{error}</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-small text-center">{uiText("ui.no.notifications")}</div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b border-line-soft last:border-b-0",
                    n.unread && "bg-surface-warm",
                  )}
                >
                  <div className="mt-0.5">
                    <Pill tone={n.tone} icon={n.icon as never}>
                      {" "}
                    </Pill>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-ink">
                      {n.title}
                    </div>
                    <div className="text-[12px] text-ink-3 truncate">
                      {n.detail}
                    </div>
                  </div>
                  <div className="text-[11px] text-ink-3 flex-shrink-0">
                    {n.age}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
