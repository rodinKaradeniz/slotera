"use client";
import * as React from "react";
import { copyText } from "@/lib/clipboard";
import Link from "next/link";
import { en, type MessageKey } from "@/i18n/messages/en";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { ProgressiveText } from "@/components/chat/ProgressiveText";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  RecoverableError,
  toError,
} from "@/components/shared/RecoverableError";
import {
  confirmAI,
  recoverAI,
  type AITurn,
} from "@/services/assistant.service";
export function AnswerCard({
  turn,
  onChange,
  animate = false,
  chat = false,
}: {
  turn: AITurn;
  animate?: boolean;
  chat?: boolean;
  onChange?: (turn: AITurn) => void;
}) {
  const { t, lang } = useI18n();
  const [copyState, setCopyState] = React.useState<
    "ready" | "copied" | "failed"
  >("ready");
  const [review, setReview] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const key = React.useRef(crypto.randomUUID());
  const proposal = turn.proposal;
  const changes = proposal?.changes as Record<string, unknown> | undefined;
  const related = (proposal?.related ?? {}) as Record<string, string>;
  const normalize = (key: string) =>
    key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const label = (key: string) => {
    const id = `ai.field.${normalize(key)}`;
    return id in en
      ? t(id as MessageKey)
      : normalize(key).replace(/([A-Z])/g, " $1");
  };
  const format = (input: unknown, key = ""): string => {
    if (typeof input === "boolean")
      return t(input ? "booking.field.yes" : "booking.field.no");
    if (typeof input === "number" && /cents/i.test(key))
      return new Intl.NumberFormat(lang, {
        style: "currency",
        currency: String(proposal?.currency ?? "EUR"),
      }).format(input / 100);
    if (typeof input === "string" && related[input]) return related[input];
    if (
      typeof input === "string" &&
      [
        "status",
        "paymentStatus",
        "confirmationPolicy",
        "bookingMode",
        "locationType",
        "cancellationRule",
        "language",
      ].includes(normalize(key))
    ) {
      const translated = `ai.value.${input}`;
      if (translated in en) return t(translated as MessageKey);
    }
    if (
      typeof input === "string" &&
      /(?:At|_at)$/.test(key) &&
      Number.isFinite(Date.parse(input))
    )
      return new Intl.DateTimeFormat(lang, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: String(proposal?.timezone ?? "UTC"),
      }).format(new Date(input));
    if (Array.isArray(input)) return input.map((v) => format(v)).join(" · ");
    if (input && typeof input === "object")
      return Object.entries(input)
        .map(([k, v]) => `${label(k)}: ${format(v, k)}`)
        .join(" · ");
    return String(input ?? "—");
  };
  const actionName = String(
    (proposal?.action as { name?: string })?.name ?? "",
  );
  const actionLabel = `ai.command.${actionName}`;
  const effects = actionName === "task.delete" ? "todo.removeEffect" : "ai.effects";
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await confirmAI(
        turn.id,
        String(proposal?.hash),
        key.current,
      );
      onChange?.(updated);
      setReview(false);
    } catch (e) {
      setReview(false);
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      className={
        chat
          ? "group min-w-0 space-y-3 border-0 bg-transparent shadow-none p-1"
          : "group min-w-0 space-y-3"
      }
    >
      <div className="flex items-center justify-between gap-2 text-micro text-ink-3">
        <p>
          {new Intl.DateTimeFormat(lang, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(turn.createdAt))}
        </p>
        {turn.answer && (
          <Button
            variant="ghost"
            size="sm"
            icon="copy"
            className="md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            aria-label={t(copyState === "copied" ? "chat.copied" : "chat.copy")}
            onClick={() => {
              void copyText(turn.answer)
                .then(() => setCopyState("copied"))
                .catch(() => setCopyState("failed"));
            }}
          />
        )}
      </div>
      {copyState === "failed" && (
        <p role="status" className="text-small">
          {t("chat.copyFailed")}
        </p>
      )}
      {turn.status === "pending" ? (
        <Button
          onClick={() => {
            void recoverAI(turn.id)
              .then(onChange)
              .catch((e) => setError(toError(e)));
          }}
        >
          {t("ai.recover")}
        </Button>
      ) : turn.status === "failed" ? (
        <p role="status">
          {t(turn.errorCode === "ai_cancelled" ? "chat.stopped" : "ai.failed")}
        </p>
      ) : (
        <ProgressiveText text={turn.answer} animate={animate} />
      )}
      <RecoverableError error={error} />
      <div className="flex flex-wrap gap-3">
        {turn.citations.map((c) => (
          <Link
            className="text-accent underline break-words"
            key={c.id}
            href={c.href}
          >
            {c.title}
          </Link>
        ))}
      </div>
      {proposal && (
        <section className="border-t border-line pt-3 space-y-3">
          <h3 className="text-h3">{t("ai.proposed")}</h3>
          <p>
            {actionLabel in en
              ? t(actionLabel as MessageKey)
              : t("ai.proposed")}
          </p>
          <p className="text-small">{String(proposal.timezone ?? "")}</p>
          <h4>{t("ai.before")}</h4>
          <p className="break-words">
            {format(
              Object.fromEntries(
                Object.entries(
                  (proposal.before ?? {}) as Record<string, unknown>,
                ).filter(
                  ([k]) =>
                    ![
                      "id",
                      "version",
                      "client_id",
                      "session_id",
                      "service_id",
                    ].includes(k),
                ),
              ),
            )}
          </p>
          <h4>{t("ai.after")}</h4>
          <dl>
            {Object.entries(changes ?? {}).map(([key, v]) => (
              <div
                className="grid grid-cols-2 gap-2 border-b border-line-soft py-2"
                key={key}
              >
                <dt>{label(key)}</dt>
                <dd className="break-words">{format(v, key)}</dd>
              </div>
            ))}
          </dl>
          {!!proposal.impact && (
            <p>
              {t("ai.affected", {
                sessions: Number(
                  (proposal.impact as Record<string, unknown>).sessionCount ??
                    0,
                ),
                bookings: Number(
                  (proposal.impact as Record<string, unknown>)
                    .activeBookingCount ?? 0,
                ),
                paid: Number(
                  (proposal.impact as Record<string, unknown>)
                    .paidBookingCount ?? 0,
                ),
              })}
            </p>
          )}
          {!!proposal.quote && (
            <p>
              {t("ai.price")}:{" "}
              {format(
                (proposal.quote as Record<string, unknown>).gross_amount_cents,
                "priceCents",
              )}
            </p>
          )}
          {actionName.startsWith("session.") && (
            <p>
              {t("ai.scope")}:{" "}
              {t(
                proposal.scope === "this_and_following"
                  ? "ai.scopeFollowing"
                  : "ai.scopeThis",
              )}
            </p>
          )}
          <p className="text-small">{t(effects)}</p>
          <Button
            disabled={proposal.status === "executed" || busy || !!error}
            onClick={() => setReview(true)}
          >
            {t(proposal.status === "executed" ? "ai.executed" : "ai.review")}
          </Button>
        </section>
      )}
      <ConfirmDialog
        open={review}
        onClose={() => !busy && setReview(false)}
        onConfirm={confirm}
        busy={busy}
        title={t("ai.confirm")}
        destructive={actionName === "task.delete"}
        description={t(effects)}
        confirmLabel={t("ai.confirm")}
      />
    </Card>
  );
}
