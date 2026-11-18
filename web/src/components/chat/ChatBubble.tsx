"use client";
import * as React from "react";
import { copyText } from "@/lib/clipboard";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/cn";
export function ChatBubble({
  text,
  createdAt,
  own = true,
  onEdit,
}: {
  text: string;
  createdAt: string;
  own?: boolean;
  onEdit?: () => void;
}) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = React.useState(false),
    [failed, setFailed] = React.useState(false);
  return (
    <article
      className={cn(
        "group flex min-w-0 flex-col",
        own ? "items-end" : "items-start",
      )}
    >
      <p
        className={cn(
          "max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-body",
          own
            ? "bg-accent-soft rounded-br-sm"
            : "bg-surface border border-line rounded-bl-sm",
        )}
      >
        {text}
      </p>
      <div className="flex items-center gap-1 text-micro text-ink-3 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <time dateTime={createdAt}>
          {new Intl.DateTimeFormat(lang, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(createdAt))}
        </time>
        <Button
          size="sm"
          variant="ghost"
          icon="copy"
          aria-label={t(copied ? "chat.copied" : "chat.copy")}
          onClick={() => {
            void copyText(text)
              .then(() => {
                setCopied(true);
                setFailed(false);
              })
              .catch(() => setFailed(true));
          }}
        />
        {onEdit && (
          <Button
            size="sm"
            variant="ghost"
            icon="edit"
            aria-label={t("chat.edit")}
            onClick={onEdit}
          />
        )}
      </div>
      {failed && (
        <p role="alert" className="text-small">
          {t("chat.copyFailed")}
        </p>
      )}
    </article>
  );
}
