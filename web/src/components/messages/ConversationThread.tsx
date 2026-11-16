"use client";
import {
  RecoverableError,
  toError,
} from "@/components/shared/RecoverableError";
import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { localeForLang } from "@/lib/i18n";
import {
  listMessages,
  markMessagesRead,
  sendMessage,
  type Message,
} from "@/services/messages.service";

export function ConversationThread({ clientId }: { clientId?: string }) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [newMessages, setNewMessages] = React.useState(false);
  const [hasOlder, setHasOlder] = React.useState(false);
  const viewport = React.useRef<HTMLDivElement>(null);
  const latest = React.useRef(0);
  const first = React.useRef<number | undefined>(undefined);
  const atBottom = React.useRef(true);
  const readThrough = React.useRef(0);
  const pending = React.useRef<symbol | null>(null);
  const scopeAbort = React.useRef<AbortController | null>(null);
  const readPending = React.useRef(0);
  const retry = React.useRef<(() => void) | null>(null);
  const submission = React.useRef<{ body: string; id: string } | null>(null);
  const read = React.useCallback(() => {
    if (
      document.visibilityState !== "visible" ||
      !atBottom.current ||
      latest.current <= readThrough.current ||
      latest.current <= readPending.current
    )
      return;
    const sequence = latest.current;
    readPending.current = sequence;
    void markMessagesRead(clientId, sequence)
      .then(() => {
        readThrough.current = Math.max(readThrough.current, sequence);
      })
      .catch(() => undefined)
      .finally(() => {
        if (readPending.current === sequence) readPending.current = 0;
      });
  }, [clientId]);
  React.useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let ownedTicket: symbol | null = null;
    scopeAbort.current = controller;
    const refresh = async () => {
      if (pending.current || document.visibilityState === "hidden") return;
      const ticket = Symbol();
      ownedTicket = ticket;
      pending.current = ticket;
      try {
        const result = await listMessages(clientId, {
          after: latest.current || undefined,
          signal: controller.signal,
        });
        if (!active) return;
        setError(null);
        if (!latest.current)
          setHasOlder(
            result.items.length === result.limit &&
              result.items[0]?.sequence > 1,
          );
        if (result.items.length) {
          first.current ??= result.items[0].sequence;
          latest.current = Math.max(
            latest.current,
            ...result.items.map((m) => m.sequence),
          );
          setMessages((old) =>
            Array.from(
              new Map([...old, ...result.items].map((m) => [m.id, m])).values(),
            ).sort((a, b) => a.sequence - b.sequence),
          );
          if (!atBottom.current) setNewMessages(true);
        }
        readThrough.current = Math.max(readThrough.current, result.readThrough);
        setLoading(false);
        if (!result.items.length) read();
      } catch (cause) {
        if (active) {
          setError(toError(cause));
          setLoading(false);
        }
      } finally {
        if (pending.current === ticket) pending.current = null;
      }
    };
    retry.current = () => {
      void refresh();
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller.abort();
      if (pending.current === ownedTicket) pending.current = null;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      retry.current = null;
    };
  }, [clientId, read]);
  React.useLayoutEffect(() => {
    if (atBottom.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
    read();
  }, [messages, read]);
  async function older() {
    if (pending.current || !first.current) return;
    const ticket = Symbol();
    pending.current = ticket;
    const signal = scopeAbort.current?.signal;
    const height = viewport.current?.scrollHeight ?? 0;
    try {
      const page = await listMessages(clientId, {
        before: first.current,
        signal,
      });
      if (signal?.aborted) return;
      first.current = page.items[0]?.sequence ?? first.current;
      setHasOlder(page.items.length === page.limit && first.current > 1);
      atBottom.current = false;
      setMessages((old) => [...page.items, ...old]);
      requestAnimationFrame(() => {
        if (viewport.current)
          viewport.current.scrollTop += viewport.current.scrollHeight - height;
      });
    } catch (cause) {
      if (!signal?.aborted) setError(toError(cause));
    } finally {
      if (pending.current === ticket) pending.current = null;
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    const body = draft.trim();
    if (submission.current?.body !== body)
      submission.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      const result = await sendMessage(clientId, body, submission.current.id);
      setMessages((old) =>
        [...old.filter((m) => m.id !== result.id), result].sort(
          (a, b) => a.sequence - b.sequence,
        ),
      );
      latest.current = Math.max(latest.current, result.sequence);
      atBottom.current = true;
      setDraft("");
      submission.current = null;
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="flex flex-col min-w-0 gap-3">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => retry.current?.()}>
          {t("ui.refresh")}
        </Button>
      </div>
      <RecoverableError error={error} />
      <ScrollArea
        className="h-[min(55vh,32rem)] flex-none rounded-lg border border-line"
        contentClassName="p-4 flex flex-col gap-3"
        viewportRef={viewport}
        onScroll={() => {
          const node = viewport.current;
          atBottom.current =
            !!node &&
            node.scrollHeight - node.scrollTop - node.clientHeight < 30;
          if (atBottom.current) {
            setNewMessages(false);
            read();
          }
        }}
      >
        {hasOlder && (
          <Button size="sm" variant="ghost" onClick={older}>
            {t("messages.older")}
          </Button>
        )}
        {loading ? (
          <p role="status">{t("messages.loading")}</p>
        ) : (
          !messages.length && <p>{t("messages.empty")}</p>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className="rounded-lg bg-paper-2 p-3 min-w-0"
          >
            <div className="text-micro text-ink-3">
              {t(
                message.senderKind === "client"
                  ? "messages.client"
                  : "messages.consultant",
              )}{" "}
              ·{" "}
              {new Intl.DateTimeFormat(localeForLang(lang), {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(message.createdAt))}
            </div>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </article>
        ))}
      </ScrollArea>
      {newMessages && (
        <Button
          variant="secondary"
          onClick={() => {
            atBottom.current = true;
            if (viewport.current)
              viewport.current.scrollTop = viewport.current.scrollHeight;
            setNewMessages(false);
            read();
          }}
        >
          {t("messages.new")}
        </Button>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Field label={t("messages.message")} required>
          <textarea
            aria-label={t("messages.message")}
            className="rounded-lg border border-line bg-surface p-3"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={4000}
            required
            disabled={busy}
            rows={3}
          />
        </Field>
        <Button type="submit" loading={busy} disabled={!draft.trim()}>
          {t("messages.send")}
        </Button>
      </form>
    </section>
  );
}
