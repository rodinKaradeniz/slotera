"use client";
import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  RecoverableError,
  toError,
} from "@/components/shared/RecoverableError";
import {
  getAIStatus,
  getBriefing,
  generateBriefing,
  type AITurn,
} from "@/services/assistant.service";
import { useLoad } from "@/lib/use-load";
import { AnswerCard } from "./AnswerCard";
export function BriefingCard({ clientId }: { clientId?: string }) {
  const { t, lang } = useI18n();
  const status = useLoad(
    React.useCallback((signal?: AbortSignal) => getAIStatus(signal), []),
  );
  const [generated, setGenerated] = React.useState<{
    epoch: number;
    turn: AITurn;
  } | null>(null);
  const epoch = status.data?.privacyEpoch;
  const setTurn = (turn: AITurn) => setGenerated({ epoch: epoch ?? 0, turn });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const previous = useLoad(
    React.useCallback(
      async (signal?: AbortSignal) => ({
        epoch,
        turn: status.data?.enabled
          ? await getBriefing(clientId ? "client" : "daily", clientId, signal)
          : null,
      }),
      [clientId, status.data?.enabled, epoch],
    ),
  );
  const shown = status.data?.enabled
    ? ((generated && generated.epoch === epoch ? generated.turn : null) ??
      (previous.data?.epoch === epoch ? previous.data?.turn : null))
    : null;
  const retry = React.useRef<{
    key: string;
    lang: string;
    refresh: boolean;
  } | null>(null);
  async function brief() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const refresh = !!shown;
    if (
      !retry.current ||
      retry.current.lang !== lang ||
      retry.current.refresh !== refresh
    )
      retry.current = { key: crypto.randomUUID(), lang, refresh };
    try {
      setTurn(
        await generateBriefing(
          clientId ? "client" : "daily",
          lang,
          retry.current.key,
          refresh,
          clientId,
        ),
      );
      retry.current = null;
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-h3">
            {t(clientId ? "ai.clientBrief" : "ai.dailyBrief")}
          </h2>
          <p className="text-small">{t("ai.briefHint")}</p>
        </div>
        {status.data?.enabled ? (
          <Button onClick={brief} loading={busy}>
            {t(shown ? "ai.refresh" : "ai.briefMe")}
          </Button>
        ) : (
          <Link
            href="/admin/settings?section=ai"
            className="text-accent underline"
          >
            {t("ai.enable")}
          </Link>
        )}
        <RecoverableError error={error} />
        {status.error && (
          <Button onClick={status.reload}>{t("ai.retry")}</Button>
        )}
      </Card>
      {shown && <AnswerCard turn={shown} onChange={setTurn} />}
    </section>
  );
}
