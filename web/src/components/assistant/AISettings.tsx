"use client";
import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { UsageBar } from "@/components/chat/UsageBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  RecoverableError,
  toError,
} from "@/components/shared/RecoverableError";
import { useLoad } from "@/lib/use-load";
import {
  getAIStatus,
  configureAI,
  clearAIHistory,
  retryAIIndex,
} from "@/services/assistant.service";
export function AISettings() {
  const { t } = useI18n();
  const load = useLoad(
    React.useCallback((signal?: AbortSignal) => getAIStatus(signal), []),
  );
  const usagePercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((load.data?.dailyTokens ?? 0) / (load.data?.tokenLimit ?? 1)) * 100,
      ),
    ),
  );
  const [error, setError] = React.useState<Error | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [review, setReview] = React.useState<"toggle" | "clear" | null>(null);
  async function apply() {
    if (busy || !load.data) return;
    setBusy(true);
    setError(null);
    try {
      if (review === "clear") await clearAIHistory();
      else await configureAI(!load.data.enabled, load.data.revision);
      setReview(null);
      load.reload();
    } catch (e) {
      setError(toError(e));
      load.reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-4 text-body">
      <h2 className="text-h3">{t("ai.settings")}</h2>
      <p>{t("ai.disclosure")}</p>
      <p>{t("ai.retention")}</p>
      <RecoverableError error={error} />
      {load.error && <Button onClick={load.reload}>{t("ai.retry")}</Button>}
      {!load.data && !load.error && <p role="status">{t("ai.loading")}</p>}
      {load.data && (
        <>
          {!load.data.available && <p role="status">{t("ai.unavailable")}</p>}
          {load.data.simulated && <p>{t("ai.simulated")}</p>}
          <UsageBar
            label={t("ask.usage", { percent: usagePercent })}
            used={usagePercent}
            limit={100}
          />
          {load.data.pending > 0 && (
            <p className="text-small">{t("ask.preparing")}</p>
          )}
          {load.data.failed > 0 && (
            <Button
              onClick={() => {
                void retryAIIndex()
                  .then(load.reload)
                  .catch((e) => setError(toError(e)));
              }}
            >
              {t("ai.retry")}
            </Button>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!load.data.available || busy}
              onClick={() => setReview("toggle")}
            >
              {t(load.data.enabled ? "ai.disable" : "ai.enable")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setReview("clear")}
            >
              {t("ai.clear")}
            </Button>
            <Button variant="ghost" onClick={load.reload}>
              {t("ui.refresh")}
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!review}
        busy={busy}
        onClose={() => !busy && setReview(null)}
        onConfirm={apply}
        title={t(review === "clear" ? "ai.clear" : "ai.settings")}
        description={t("ai.retention")}
        confirmLabel={t("ai.confirm")}
      />
    </Card>
  );
}
