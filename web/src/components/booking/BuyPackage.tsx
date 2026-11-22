"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/money";
import type { PackageBuyer, PackageRequest } from "@/services/package-purchases.service";
import type { PackageOffer } from "@/services/packages.service";
import type { Currency } from "@/types/common";

export const EMPTY_BUYER: PackageBuyer & { consent: boolean } = {
  firstName: "", lastName: "", email: "", phone: "", consent: false,
};
export type BuyerDraft = typeof EMPTY_BUYER;

export function buyerReady(buyer: BuyerDraft): boolean {
  return !!(buyer.firstName.trim() && buyer.lastName.trim() && /.+@.+\..+/.test(buyer.email.trim()) && buyer.consent);
}

/** Who is buying the package, and their agreement to the terms. */
export function BuyPackageForm({ offer, provider, terms, buyer, onChange }: {
  offer: PackageOffer;
  provider: string;
  terms?: { enabled: boolean; content: string };
  buyer: BuyerDraft;
  onChange: (buyer: BuyerDraft) => void;
}) {
  const { t } = useI18n();
  const update = (patch: Partial<BuyerDraft>) => onChange({ ...buyer, ...patch });
  const [before, after] = t("booking.details.consent").split("{terms}");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small">
        {t("booking.packages.buyBody", {
          sessions: offer.items.length,
          price: formatMoney(offer.priceCents, offer.currency),
          provider,
        })}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("booking.details.firstName")} required>
          <Input value={buyer.firstName} autoComplete="given-name" onChange={(e) => update({ firstName: e.target.value })} />
        </Field>
        <Field label={t("booking.details.lastName")} required>
          <Input value={buyer.lastName} autoComplete="family-name" onChange={(e) => update({ lastName: e.target.value })} />
        </Field>
        <Field label={t("booking.details.email")} required>
          <Input type="email" icon="mail" autoComplete="email" value={buyer.email} onChange={(e) => update({ email: e.target.value })} />
        </Field>
        <Field label={t("booking.details.phone")}>
          <Input type="tel" icon="phone" autoComplete="tel" value={buyer.phone} onChange={(e) => update({ phone: e.target.value })} />
        </Field>
      </div>
      {terms?.enabled && terms.content.trim() && (
        <details className="rounded-md border border-line-soft bg-paper-2 px-3 py-2 text-small">
          <summary className="cursor-pointer text-ink">{t("booking.packages.providerTerms", { provider })}</summary>
          <p className="mt-2 whitespace-pre-line text-ink-2">{terms.content}</p>
        </details>
      )}
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[color:var(--accent)]" checked={buyer.consent}
          onChange={(e) => update({ consent: e.target.checked })} />
        <span className="text-small text-ink-2">
          {before}
          <Link href="/terms" target="_blank" className="underline text-ink hover:text-accent">
            {t("booking.details.consentLink")}
          </Link>
          {after ?? ""}
        </span>
      </label>
    </div>
  );
}

/** After the request: how to pay, or that the (free) package is ready. */
export function BuyPackageDone({ result, provider }: { result: PackageRequest; provider: string }) {
  const { t } = useI18n();
  if (result.paymentStatus === "paid") return <p className="text-body">{t("booking.packages.readyBody")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body">
        {t("client.packages.payBody", { amount: formatMoney(result.priceCents, result.currency as Currency) })}
      </p>
      {result.manualPaymentInstructions.trim() && (
        <p className="rounded-md border border-line bg-paper-2 p-4 text-body whitespace-pre-line text-ink">
          {result.manualPaymentInstructions}
        </p>
      )}
      <p className="text-small">{t("booking.packages.requestedBody", { provider })}</p>
    </div>
  );
}
