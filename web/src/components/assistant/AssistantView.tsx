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
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { useLoad } from "@/lib/use-load";
import { ApiRequestError } from "@/services/_errors";
import {
  getAIStatus,
  listAIThreads,
  createAIThread,
  deleteAIThread,
  listAITurns,
  generateAITurn,
  type AITurn,
  type AIThread,
} from "@/services/assistant.service";
import { AnswerCard } from "./AnswerCard";
export function AssistantView() {
  const { t, lang } = useI18n();
  useSetCrumbs([{ label: t("nav.assistant") }]);
  const status = useLoad(
    React.useCallback((signal?: AbortSignal) => getAIStatus(signal), []),
  );
  const [offset, setOffset] = React.useState(0),
    [turnOffset, setTurnOffset] = React.useState(0);
  const threads = useLoad(
    React.useCallback(
      (signal?: AbortSignal) => listAIThreads(offset, signal),
      [offset],
    ),
  );
  const [selected, setSelected] = React.useState<AIThread | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [remove, setRemove] = React.useState(false);
  const messages = useLoad(
    React.useCallback(
      (signal?: AbortSignal) =>
        selected
          ? listAITurns(selected.id, turnOffset, signal)
          : Promise.resolve({
              items: [] as AITurn[],
              total: 0,
              limit: 25,
              offset: 0,
            }),
      [selected, turnOffset],
    ),
  );
  const submission = React.useRef<{
    key: string;
    prompt: string;
    language: string;
    threadId: string;
  } | null>(null);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true);
    setError(null);
    const prompt = draft.trim();
    if (
      !submission.current ||
      submission.current.prompt !== prompt ||
      submission.current.language !== lang
    )
      submission.current = {
        key: crypto.randomUUID(),
        prompt,
        language: lang,
        threadId: selected?.id ?? crypto.randomUUID(),
      };
    try {
      const attempt = submission.current;
      const thread =
        selected ??
        (await createAIThread(attempt.threadId, prompt.slice(0, 100)));
      setSelected(thread);
      const answer = await generateAITurn(thread.id, prompt, lang, attempt.key);
      messages.reload();
      threads.reload();
      status.reload();
      if (answer.status === "completed") {
        setDraft("");
        submission.current = null;
      } else if (answer.status === "failed") {
        submission.current = null;
        setError(new Error("Failed"));
      }
    } catch (e) {
      setError(toError(e));
      if (e instanceof ApiRequestError && e.status > 0)
        submission.current = null;
    } finally {
      setBusy(false);
    }
  }
  async function erase() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await deleteAIThread(selected.id);
      setSelected(null);
      setRemove(false);
      threads.reload();
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageContainer>
      <h1 className="text-h1 mb-3">{t("nav.assistant")}</h1>
      <p className="mb-5 text-small">{t("ai.intro")}</p>
      {status.data?.simulated && <p className="mb-4">{t("ai.simulated")}</p>}
      {status.data && !status.data.enabled ? (
        <Card>
          <p>{t("ai.disabled")}</p>
          <Link
            className="text-accent underline"
            href="/admin/settings?section=ai"
          >
            {t("ai.enable")}
          </Link>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <Card className="space-y-3">
            <Button
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setDraft("");
                setTurnOffset(0);
                submission.current = null;
              }}
            >
              {t("ai.newChat")}
            </Button>
            {threads.data?.items.map((thread) => (
              <div key={thread.id}>
                <Button
                  disabled={busy}
                  variant={selected?.id === thread.id ? "secondary" : "ghost"}
                  onClick={() => {
                    setSelected(thread);
                    setTurnOffset(0);
                    submission.current = null;
                  }}
                >
                  {thread.title}
                </Button>
              </div>
            ))}
            {threads.error && (
              <Button onClick={threads.reload}>{t("ai.retry")}</Button>
            )}
            <div className="flex justify-between">
              <Button
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                {t("todo.previous")}
              </Button>
              <Button
                disabled={!threads.data || offset + 25 >= threads.data.total}
                onClick={() => setOffset(offset + 25)}
              >
                {t("todo.next")}
              </Button>
            </div>
          </Card>
          <section className="min-w-0 space-y-4">
            <RecoverableError error={error} />
            {selected && (
              <Button
                variant="ghost"
                onClick={() => setRemove(true)}
                disabled={busy}
              >
                {t("ai.deleteChat")}
              </Button>
            )}
            {messages.loading && selected && (
              <p role="status">{t("ai.loading")}</p>
            )}
            {messages.error && (
              <Button onClick={messages.reload}>{t("ai.retry")}</Button>
            )}
            {messages.data?.items.map((turn) => (
              <section key={turn.id} className="space-y-2">
                <p className="whitespace-pre-wrap break-words font-medium">
                  {turn.prompt}
                </p>
                <AnswerCard turn={turn} onChange={() => messages.reload()} />
              </section>
            ))}
            <div className="flex justify-between">
              <Button
                disabled={
                  !messages.data || turnOffset + 25 >= messages.data.total
                }
                onClick={() => setTurnOffset(turnOffset + 25)}
              >
                {t("ai.older")}
              </Button>
              <Button
                disabled={!turnOffset}
                onClick={() => setTurnOffset(Math.max(0, turnOffset - 25))}
              >
                {t("ai.newer")}
              </Button>
            </div>
            <form onSubmit={send} className="space-y-3">
              <Field label={t("ai.question")} required>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={4000}
                  required
                  rows={4}
                  disabled={busy}
                  aria-label={t("ai.question")}
                />
              </Field>
              <Button
                type="submit"
                loading={busy}
                disabled={!draft.trim() || !status.data?.enabled}
              >
                {t("ai.send")}
              </Button>
            </form>
          </section>
        </div>
      )}
      <ConfirmDialog
        open={remove}
        busy={busy}
        onClose={() => !busy && setRemove(false)}
        onConfirm={erase}
        title={t("ai.deleteChat")}
        description={t("ai.deleteHint")}
        confirmLabel={t("ai.deleteChat")}
        destructive
      />
    </PageContainer>
  );
}
