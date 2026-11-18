"use client";
import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  RecoverableError,
  toError,
} from "@/components/shared/RecoverableError";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Textarea } from "@/components/ui/Textarea";
import type { Lang } from "@/lib/i18n";
import { usePagedHistory } from "@/lib/use-paged-history";
import { ConversationRow } from "./ConversationRow";
import { Icon } from "@/components/ui/Icon";
import { useLoad } from "@/lib/use-load";
import { ApiRequestError } from "@/services/_errors";
import {
  getAIStatus,
  listAIThreads,
  createAIThread,
  deleteAIThread,
  listAITurns,
  generateAITurn,
  stopAITurn,
  branchAIThread,
  type AITurn,
  type AIThread,
} from "@/services/assistant.service";
import { AnswerCard } from "./AnswerCard";
export function AssistantView() {
  const { t, lang } = useI18n();
  useSetCrumbs([{ label: t("ask.title") }]);
  const status = useLoad(
    React.useCallback((signal?: AbortSignal) => getAIStatus(signal), []),
  );
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const threads = usePagedHistory(
    "threads",
    React.useCallback(
      (offset: number, signal: AbortSignal) => listAIThreads(offset, signal),
      [],
    ),
  );
  const [selected, setSelected] = React.useState<AIThread | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [removing, setRemoving] = React.useState<AIThread | null>(null);
  const [localTurn, setLocalTurn] = React.useState<AITurn | null>(null);
  const [editTarget, setEditTarget] = React.useState<AITurn | null>(null);
  const stopRequested = React.useRef(false);
  const viewport = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLTextAreaElement>(null);
  const nearBottom = React.useRef(true);
  React.useLayoutEffect(() => {
    if (nearBottom.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  });

  const messages = usePagedHistory(
    selected?.id ?? "empty",
    React.useCallback(
      (offset: number, signal: AbortSignal) =>
        selected
          ? listAITurns(selected.id, offset, signal)
          : Promise.resolve({
              items: [] as AITurn[],
              total: 0,
              limit: 25,
              offset: 0,
            }),
      [selected],
    ),
    true,
  );
  React.useEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) node.scrollTop = node.scrollHeight;
    });
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [selected?.id, status.data?.enabled]);
  const submission = React.useRef<{
    key: string;
    prompt: string;
    language: Lang;
    threadId: string;
  } | null>(null);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true);
    setError(null);
    const prompt = draft.trim();
    stopRequested.current = false;
    if (
      !submission.current ||
      submission.current.prompt !== prompt ||
      submission.current.language !== lang
    )
      submission.current = {
        key: crypto.randomUUID(),
        prompt,
        language: lang,
        threadId: editTarget
          ? crypto.randomUUID()
          : (selected?.id ?? crypto.randomUUID()),
      };
    try {
      const attempt = submission.current;
      setLocalTurn({
        id: attempt.key,
        threadId: attempt.threadId,
        prompt,
        answer: "",
        status: "pending",
        language: lang,
        createdAt: new Date().toISOString(),
        citations: [],
        proposal: null,
        errorCode: null,
      });
      nearBottom.current = true;
      const thread =
        editTarget && selected
          ? await branchAIThread(
              selected.id,
              editTarget.id,
              attempt.threadId,
              prompt.slice(0, 100),
            )
          : (selected ??
            (await createAIThread(attempt.threadId, prompt.slice(0, 100))));
      setEditTarget(null);
      setSelected(thread);
      threads.reload();
      if (stopRequested.current) {
        setLocalTurn(null);
        return;
      }
      const answer = await generateAITurn(thread.id, prompt, lang, attempt.key);
      setLocalTurn(answer);
      messages.reload();
      threads.reload();
      status.reload();
      if (answer.status === "completed") {
        setDraft("");
        submission.current = null;
      } else if (answer.status === "failed") {
        submission.current = null;
        if (answer.errorCode !== "ai_cancelled") setError(new Error("Failed"));
      }
    } catch (e) {
      if (stopRequested.current) {
        setLocalTurn((old) =>
          old ? { ...old, status: "failed", errorCode: "ai_cancelled" } : null,
        );
        messages.reload();
      } else {
        setError(toError(e));
        setLocalTurn(null);
      }
      if (e instanceof ApiRequestError && e.status > 0)
        submission.current = null;
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    if (!submission.current) return;
    stopRequested.current = true;
    const current = submission.current;
    if (selected?.id === current.threadId) {
      try {
        await stopAITurn(
          current.threadId,
          current.key,
          current.prompt,
          current.language,
        );
      } catch (e) {
        setError(toError(e));
      }
    }
  }
  async function erase() {
    if (!removing || busy) return;
    setBusy(true);
    try {
      await deleteAIThread(removing.id);
      if (selected?.id === removing.id) {
        setSelected(null);
        setLocalTurn(null);
        setDraft("");
      }
      setRemoving(null);
      threads.reload();
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }
  const turns = [
    ...messages.items,
    ...(localTurn &&
    (!selected || localTurn.threadId === selected.id) &&
    !messages.items.some((turn) => turn.id === localTurn.id)
      ? [localTurn]
      : []),
  ];
  const empty =
    !localTurn &&
    (!selected ||
      (!messages.loading && !messages.error && !messages.items.length));
  const composer = (
    <div className="w-full max-w-3xl mx-auto space-y-2">
      {editTarget && <p className="text-small">{t("chat.branchHint")}</p>}
      <form
        onSubmit={send}
        className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3 shadow-card"
      >
        <Textarea
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
          required
          rows={2}
          disabled={busy}
          aria-label={t("ai.question")}
          placeholder={t("ask.placeholder")}
          className="flex-1 min-w-0 border-0 shadow-none"
        />
        {busy ? (
          <Button
            icon="pause"
            aria-label={t("chat.stop")}
            onClick={() => void stop()}
          />
        ) : (
          <Button
            type="submit"
            icon="arrow-up"
            aria-label={t("ai.send")}
            disabled={!draft.trim() || !status.data?.enabled}
          />
        )}
      </form>
    </div>
  );
  return (
    <PageContainer width="wide" className="flex flex-col flex-1 min-h-0">
      {status.data && !status.data.enabled ? (
        <Card>
          <h1 className="text-h3 mb-2">{t("ask.title")}</h1>
          <p>{t("ai.disabled")}</p>
          <Link
            className="text-accent underline"
            href="/admin/settings?section=ai"
          >
            {t("ai.enable")}
          </Link>
        </Card>
      ) : (
        <>
          <Button
            variant="secondary"
            className="md:hidden mb-3 self-start"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            {t("chat.conversations")}
          </Button>
          <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-[minmax(13rem,1fr)_minmax(0,3fr)]">
            <Card
              className={`${historyOpen ? "flex" : "hidden"} md:flex flex-col gap-3 min-h-0 min-w-0`}
            >
              <Button
                icon="plus"
                disabled={busy}
                onClick={() => {
                  setSelected(null);
                  setHistoryOpen(false);
                  setLocalTurn(null);
                  setEditTarget(null);
                  setDraft("");
                  submission.current = null;
                }}
              >
                {t("ai.newChat")}
              </Button>
              <ScrollArea
                className="min-h-0 flex-1"
                onScroll={(event) => {
                  const node = event.currentTarget;
                  if (
                    node.scrollHeight - node.scrollTop - node.clientHeight <
                    40
                  )
                    void threads.more();
                }}
              >
                {!threads.loading &&
                  !threads.error &&
                  !threads.items.length && (
                    <div className="py-8 text-center space-y-2">
                      <Icon
                        name="ask"
                        className="mx-auto text-ink-4"
                        size={24}
                      />
                      <p className="text-body">{t("ask.noChats")}</p>
                      <p className="text-small">{t("ask.historyHint")}</p>
                    </div>
                  )}
                {threads.items.map((thread) => (
                  <ConversationRow
                    key={thread.id}
                    thread={thread}
                    active={selected?.id === thread.id}
                    busy={busy}
                    onOpen={() => {
                      setSelected(thread);
                      setHistoryOpen(false);
                      setLocalTurn(null);
                      setEditTarget(null);
                      submission.current = null;
                    }}
                    onDelete={() => setRemoving(thread)}
                  />
                ))}
                {(threads.loading || threads.paging) && (
                  <p role="status" className="text-small">
                    {t("ai.loading")}
                  </p>
                )}
                {threads.error && (
                  <Button onClick={threads.reload}>{t("ai.retry")}</Button>
                )}
              </ScrollArea>
            </Card>
            <section className="min-w-0 min-h-0 flex flex-col gap-4 rounded-xl bg-paper p-3">
              <RecoverableError error={error} />
              {!empty && (
                <header>
                  <h1 className="text-h3">{t("ask.title")}</h1>
                  <p className="text-small">{t("ai.intro")}</p>
                </header>
              )}
              {empty ? (
                <div className="flex flex-1 flex-col min-h-0 items-center justify-center gap-6">
                  <div className="text-center space-y-2">
                    <h1 className="text-h2">{t("ask.title")}</h1>
                    <p className="text-small">{t("ai.intro")}</p>
                  </div>
                  {composer}
                </div>
              ) : (
                <>
                  {messages.error && (
                    <Button onClick={messages.reload}>{t("ai.retry")}</Button>
                  )}
                  <ScrollArea
                    viewportRef={viewport}
                    className="min-h-0 flex-1"
                    contentClassName="space-y-5 p-2"
                    onScroll={(event) => {
                      const node = event.currentTarget;
                      nearBottom.current =
                        node.scrollHeight - node.scrollTop - node.clientHeight <
                        40;
                      if (
                        node.scrollTop < 8 &&
                        messages.hasMore &&
                        !messages.loading &&
                        !messages.paging
                      ) {
                        const height = node.scrollHeight;
                        nearBottom.current = false;
                        void messages.more().then(() =>
                          requestAnimationFrame(() => {
                            node.scrollTop += node.scrollHeight - height;
                          }),
                        );
                      }
                    }}
                  >
                    {(messages.loading || messages.paging) && (
                      <p role="status" className="text-small">
                        {t("ai.loading")}
                      </p>
                    )}
                    {turns.map((turn) => (
                      <section key={turn.id} className="space-y-2">
                        <ChatBubble
                          text={turn.prompt}
                          createdAt={turn.createdAt}
                          onEdit={
                            !busy && turn.status !== "pending"
                              ? () => {
                                  setEditTarget(turn);
                                  setDraft(turn.prompt);
                                  submission.current = null;
                                  input.current?.focus();
                                }
                              : undefined
                          }
                        />
                        {turn.status === "pending" ? (
                          <p role="status" className="text-small">
                            {t("ai.loading")}
                          </p>
                        ) : (
                          <AnswerCard
                            chat
                            turn={turn}
                            animate={turn.id === localTurn?.id}
                            onChange={messages.reload}
                          />
                        )}
                      </section>
                    ))}
                  </ScrollArea>
                  <footer className="shrink-0">{composer}</footer>
                </>
              )}
              <div className="shrink-0 text-center space-y-1">
                {status.data?.simulated && (
                  <p className="text-micro text-ink-3">{t("ai.simulated")}</p>
                )}
                <p className="text-micro text-ink-3">{t("chat.disclaimer")}</p>
              </div>
            </section>
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!removing}
        busy={busy}
        onClose={() => !busy && setRemoving(null)}
        onConfirm={erase}
        title={t("ai.deleteChat")}
        description={t("ai.deleteHint")}
        confirmLabel={t("ai.deleteChat")}
        destructive
      />
    </PageContainer>
  );
}
