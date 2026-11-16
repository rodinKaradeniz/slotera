"use client";
import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import {
  getDigestPreference,
  saveDigestPreference,
  type DigestPreference,
} from "@/services/message-notifications.service";
import { useLoad } from "@/lib/use-load";
function Editor({ initial }: { initial: DigestPreference }) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [review, setReview] = React.useState<DigestPreference | null>(null);
  async function save() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setDraft(await saveDigestPreference(draft));
    } catch {
      setFailed(true);
      try {
        setReview(await getDigestPreference());
      } catch {
        setReview(null);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border-t border-line pt-4 flex flex-col gap-3">
      <label>
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) =>
            setDraft({ ...draft, enabled: event.target.checked })
          }
        />{" "}
        {t("client.digest")}
      </label>
      <p className="text-small">{t("messages.digestHint")}</p>
      {failed && <p role="alert">{t("followup.failed")}</p>}
      {review && (
        <Button
          variant="secondary"
          onClick={() => {
            setDraft(review);
            setReview(null);
            setFailed(false);
          }}
        >
          {t("followup.reviewAgain")}
        </Button>
      )}
      <Button
        variant="secondary"
        loading={busy}
        disabled={!!review}
        onClick={save}
      >
        {t("client.save")}
      </Button>
    </section>
  );
}
export function MessageDigestPreference() {
  const { t } = useI18n();
  const result = useLoad(
    React.useCallback(
      (signal?: AbortSignal) => getDigestPreference(signal),
      [],
    ),
  );
  return result.data ? (
    <Editor initial={result.data} />
  ) : (
    <p role={result.error ? "alert" : "status"}>
      {t(result.error ? "client.failed" : "messages.loading")}
      {result.error && (
        <Button onClick={result.reload}>{t("ui.refresh")}</Button>
      )}
    </p>
  );
}
