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
export function OperatorMessages() {
  const { t } = useI18n();
  useSetCrumbs([{ label: t("client.messages") }]);
  const params = useSearchParams();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(
    params.get("clientId"),
  );
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const conversations = usePagedHistory("conversations", React.useCallback(async (offset: number, signal: AbortSignal) => { const page = await listConversations(offset, signal); return {...page, items: page.items.map((item) => ({...item, id: item.clientId}))}; }, []));
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
          {conversations.items.map((item) => (
            <div key={item.clientId} className="min-w-0">
              <Button
                full
                className="justify-start h-auto py-3 whitespace-normal break-words text-left"
                variant={selected === item.clientId ? "secondary" : "ghost"}
                onClick={() => {
                  setSelected(item.clientId);
                  setHistoryOpen(false);
                  setSelectedLabel(item.clientName);
                }}
              >
                {item.clientName}{" "}
                {item.unreadCount ? `(${item.unreadCount})` : ""}
              </Button>
            </div>
          ))}
        </Card>
        <Card className="min-w-0 min-h-0 flex flex-col gap-3">
          {selected && (
            <h2 className="text-h3">
              {selectedLabel ??
                conversations.items.find(
                  (item) => item.clientId === selected,
                )?.clientName ??
                t("client.messages")}
            </h2>
          )}
          {selected ? (
            <ConversationThread fill key={selected} clientId={selected} />
          ) : (
            <p>{t("messages.chooseClient")}</p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
