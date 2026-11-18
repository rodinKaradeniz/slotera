"use client";
import * as React from "react";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadError } from "@/components/shared/LoadError";
import { ConversationThread } from "./ConversationThread";
import { listConversations } from "@/services/messages.service";
import { searchClients } from "@/services/clients.service";
import { usePagedHistory } from "@/lib/use-paged-history";
import { useLoad } from "@/lib/use-load";
import { localeForLang } from "@/lib/i18n";
import { cn } from "@/lib/cn";
export function OperatorMessages() {
  const { t, lang } = useI18n();
  useSetCrumbs([{ label: t("client.messages") }]);
  const params = useSearchParams();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(
    params.get("clientId"),
  );
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const conversations = usePagedHistory("conversations", React.useCallback(async (offset: number, signal: AbortSignal) => { const page = await listConversations(offset, signal); return {...page, items: page.items.map((item) => ({...item, id: item.clientId}))}; }, []));
  // With nothing picked, the newest conversation opens instead of an empty pane.
  const active = selected ?? conversations.items[0]?.clientId ?? null;
  const search = useLoad(
    React.useCallback(
      async (signal?: AbortSignal) => {
        if (!query.trim()) return [];
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 250);
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Cancelled", "AbortError"));
            },
            { once: true },
          );
        });
        return searchClients(query, signal);
      },
      [query],
    ),
  );
  return (
    <PageContainer className="flex flex-col flex-1 min-h-0">
      <Button
        variant="secondary"
        className="md:hidden mb-3 self-start"
        aria-expanded={historyOpen}
        onClick={() => setHistoryOpen(!historyOpen)}
      >
        {t("chat.conversations")}
      </Button>
      <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-[minmax(14rem,1fr)_minmax(0,3fr)]">
        <Card onScroll={(event) => { const n = event.currentTarget; if(n.scrollHeight-n.scrollTop-n.clientHeight<40) void conversations.more(); }}
          className={`${historyOpen ? "block" : "hidden"} md:block min-h-0 overflow-y-auto min-w-0 space-y-3`}
        >
          <Input
            aria-label={t("messages.findClient")}
            placeholder={t("messages.findClient")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {search.error && (
            <LoadError message={search.error} onRetry={search.reload} />
          )}
          {query &&
            search.data?.map((client) => (
              <Button
                key={client.id}
                variant="ghost"
                onClick={() => {
                  setSelected(client.id);
                  setHistoryOpen(false);
                  setSelectedLabel(client.name);
                  setQuery("");
                }}
              >
                {client.name}
              </Button>
            ))}
          {conversations.error && (
            <LoadError
              message={conversations.error.message}
              onRetry={conversations.reload}
            />
          )}
          <ul className="-mx-2">
            {conversations.items.map((item) => (
              <li key={item.clientId}>
                <button
                  type="button"
                  aria-current={active === item.clientId ? "true" : undefined}
                  onClick={() => {
                    setSelected(item.clientId);
                    setHistoryOpen(false);
                    setSelectedLabel(item.clientName);
                  }}
                  className={cn(
                    "w-full text-left rounded-md px-3 py-2.5 transition-colors duration-(--d-press) ease-out",
                    active === item.clientId ? "bg-paper-2" : "hover:bg-surface-warm",
                  )}
                >
                  <span className="flex items-baseline gap-2">
                    <span className={cn("flex-1 min-w-0 truncate text-[14px] text-ink", item.unreadCount > 0 && "font-semibold")}>
                      {item.clientName}
                    </span>
                    <time dateTime={item.lastMessageAt} className="shrink-0 text-micro text-ink-3 tabular-nums">
                      {shortWhen(item.lastMessageAt, localeForLang(lang))}
                    </time>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="flex-1 min-w-0 truncate text-small text-ink-3">
                      {item.lastMessageFrom === "operator" && `${t("messages.you")}: `}{item.lastMessagePreview}
                    </span>
                    {item.unreadCount > 0 && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-accent" aria-label={t("messages.unread", { count: item.unreadCount })} />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="min-w-0 min-h-0 flex flex-col gap-3">
          {active && (
            <h2 className="text-h3">
              {(selected && selectedLabel) ??
                conversations.items.find(
                  (item) => item.clientId === active,
                )?.clientName ??
                t("client.messages")}
            </h2>
          )}
          {active ? (
            <ConversationThread fill key={active} clientId={active} />
          ) : (
            <p>{t("messages.chooseClient")}</p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

/** "09:40" today, "Mon" within the week, otherwise "14 May". */
function shortWhen(iso: string, locale: string): string {
  const at = new Date(iso);
  const now = new Date();
  if (at.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(at);
  }
  if (now.getTime() - at.getTime() < 6 * 86_400_000) {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(at);
  }
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(at);
}
