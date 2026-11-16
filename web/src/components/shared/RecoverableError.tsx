"use client";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ApiRequestError } from "@/services/_errors";
import type { MessageKey } from "@/i18n/messages/en";
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Request failed");
}
export function RecoverableError({
  error,
  messageKey = "client.failed",
}: {
  error: Error | null;
  messageKey?: MessageKey;
}) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <p role="alert" className="text-danger">
      {error instanceof ApiRequestError ? error.message : t(messageKey)}
    </p>
  );
}
