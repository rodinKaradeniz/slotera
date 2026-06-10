"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { getSettings } from "@/services/settings.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localeForLang } from "@/lib/i18n";
import { COUNTRIES } from "./types";
import type { BookingDraft } from "./types";
import { ReceiptCard } from "./ReceiptCard";

type Props = {
  draft: BookingDraft;
  onEdit: (step: "service" | "time" | "details" | "forms" | "billing") => void;
};

export function StepReview({ draft, onEdit }: Props) {
  const { t, lang } = useI18n();
  const locale = localeForLang(lang);
  const country =
    COUNTRIES.find((c) => c.code === draft.billing.country) ?? COUNTRIES[0];
  const completedForms = Object.values(draft.formResponses).filter(
    (answers) => answers.length > 0,
  ).length;
  const [manualInstructions, setManualInstructions] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    getSettings().then((s) =>
      setManualInstructions(s.payments.manualPaymentInstructions ?? null),
    );
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-stretch h-full">
      <div className="flex flex-col gap-3 h-full">
        <SummaryRow
          title={t("booking.review.service")}
          value={draft.service?.name ?? "—"}
          hint={draft.service ? `${draft.service.durationMin} min` : undefined}
          onEdit={() => onEdit("service")}
        />
        <SummaryRow
          title={t("booking.review.when")}
          value={
            draft.date && draft.time
              ? `${new Date(draft.date).toLocaleDateString(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })} · ${draft.time}`
              : "—"
          }
          onEdit={() => onEdit("time")}
        />
        <SummaryRow
          title={t("booking.review.details")}
          value={
            `${draft.customer.firstName} ${draft.customer.lastName}`.trim() ||
            "—"
          }
          hint={draft.customer.email || undefined}
          onEdit={() => onEdit("details")}
        />
        {completedForms > 0 && (
          <SummaryRow
            title={t("booking.review.forms")}
            value={t("booking.review.formsCompleted", { count: completedForms })}
            onEdit={() => onEdit("forms")}
          />
        )}
        <SummaryRow
          title={t("booking.review.billing")}
          value={draft.billing.street || "—"}
          hint={
            draft.billing.city
              ? `${draft.billing.zip} ${draft.billing.city} · ${country.name}`
              : country.name
          }
          onEdit={() => onEdit("billing")}
        />
      </div>

      <ReceiptCard
        draft={draft}
        variant="review"
        manualInstructions={manualInstructions}
      />
    </div>
  );
}

function SummaryRow({
  title,
  value,
  hint,
  onEdit,
}: {
  title: string;
  value: string;
  hint?: string;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card padded={false} className="px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-micro">{title}</div>
        <div className="text-[15px] text-ink mt-1 truncate">{value}</div>
        {hint && <div className="text-small mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-[13px] text-ink-3 hover:text-ink inline-flex items-center gap-1"
      >
        <Icon name="edit" size={13} /> {t("booking.review.edit")}
      </button>
    </Card>
  );
}
