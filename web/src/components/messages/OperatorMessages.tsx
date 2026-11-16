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
import { useLoad } from "@/lib/use-load";
export function OperatorMessages() {
  const { t } = useI18n();
  useSetCrumbs([{ label: t("client.messages") }]);
  const params = useSearchParams();
  const [selected, setSelected] = React.useState<string | null>(
    params.get("clientId"),
  );
  const [query, setQuery] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const load = React.useCallback(
    (signal?: AbortSignal) => listConversations(offset, signal),
    [offset],
  );
  const conversations = useLoad(load);
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
    <PageContainer>
      <h1 className="text-h1 mb-6">{t("client.messages")}</h1>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
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
                  setQuery("");
                }}
              >
                {client.name}
              </Button>
            ))}
          {conversations.error && (
            <LoadError
              message={conversations.error}
              onRetry={conversations.reload}
            />
          )}
          {conversations.data?.items.map((item) => (
            <div key={item.clientId}>
              <Button
                variant={selected === item.clientId ? "secondary" : "ghost"}
                onClick={() => setSelected(item.clientId)}
              >
                {item.clientName}{" "}
                {item.unreadCount ? `(${item.unreadCount})` : ""}
              </Button>
            </div>
          ))}
          <div className="flex justify-between mt-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 25))}
            >
              {t("todo.previous")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={
                !conversations.data || offset + 25 >= conversations.data.total
              }
              onClick={() => setOffset(offset + 25)}
            >
              {t("todo.next")}
            </Button>
          </div>
        </Card>
        <Card>
          {selected ? (
            <ConversationThread key={selected} clientId={selected} />
          ) : (
            <p>{t("messages.chooseClient")}</p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
