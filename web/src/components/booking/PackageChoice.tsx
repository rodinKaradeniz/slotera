"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { ClientPackage } from "@/services/client-access.service";

/**
 * Shown to a signed-in client whose paid package covers the chosen service: book with the
 * package (the default), or pay for this session as usual.
 */
export function PackageChoice({ packages, chosenId, serviceId, onChange }: {
  packages: ClientPackage[];
  chosenId: string | null;
  serviceId: string;
  onChange: (purchaseId: string) => void;
}) {
  const { t } = useI18n();
  const left = (item: ClientPackage) =>
    item.sessions.filter((session) => session.serviceId === serviceId && !session.bookedFor).length;
  const option = (value: string, label: string) => (
    <label key={value} className="flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 cursor-pointer has-[:checked]:border-accent">
      <input type="radio" name="package-choice" value={value} checked={(chosenId ?? "") === value}
        onChange={() => onChange(value)} className="accent-[var(--color-accent)]" />
      <span className="text-[14px] text-ink">{label}</span>
    </label>
  );
  return (
    <fieldset className="mt-6 flex flex-col gap-2">
      <legend className="text-[13px] font-medium text-ink mb-2">{t("booking.packageUse.title")}</legend>
      {packages.map((item) => option(item.id, t("booking.packageUse.option", { name: item.packageName, count: left(item) })))}
      {option("", t("booking.packageUse.pay"))}
    </fieldset>
  );
}
