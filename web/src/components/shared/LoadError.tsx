"use client";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Props = { message: string; onRetry: () => void };

/** Shown in place of a list or page whose request failed. */
export function LoadError({ message, onRetry }: Props) {
  const { t } = useI18n();
  return (
    <Card className="flex flex-col items-start gap-3" role="alert">
      <div className="text-[13px] font-medium text-ink">{t("ui.couldn.t.load.this")}</div>
      <div className="text-[13px] text-ink-3">{message}</div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t("forms.retry")}
      </Button>
    </Card>
  );
}
