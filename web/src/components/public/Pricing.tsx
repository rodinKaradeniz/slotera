"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { SignupCta } from "./SignupCta";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PLAN_PRICES, type BillingInterval, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/cn";
import type { Messages } from "@/i18n/messages/en";

// Prices come from lib/plans.ts, which mirrors the server's plans (docs/PRODUCT.md →
// Pricing). Both tiers share the core features; Professional adds a lower card cut and
// the extras below.
const COPY: Record<PlanId, { name: keyof Messages; blurb: keyof Messages; fee: keyof Messages }> = {
  essentials: {
    name: "landing.pricing.essentials.name",
    blurb: "landing.pricing.essentials.blurb",
    fee: "landing.pricing.essentials.fee",
  },
  professional: {
    name: "landing.pricing.professional.name",
    blurb: "landing.pricing.professional.blurb",
    fee: "landing.pricing.professional.fee",
  },
};

const CORE_FEATURES: (keyof Messages)[] = [
  "landing.pricing.f1",
  "landing.pricing.f2",
  "landing.pricing.f3",
  "landing.pricing.f4",
];

const PROFESSIONAL_EXTRAS: (keyof Messages)[] = [
  "landing.pricing.p1",
  "landing.pricing.p2",
  "landing.pricing.p3",
];

function pounds(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function Pricing() {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<BillingInterval>("monthly");

  return (
    <Section id="pricing">
      <SectionHeader
        eyebrow={t("landing.pricing.eyebrow")}
        title={t("landing.pricing.title")}
        maxTitleWidth="44rem"
      />
      <div
        role="radiogroup"
        className="inline-flex mb-6 rounded-md border border-line bg-surface p-1 gap-1"
      >
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={period === option}
            onClick={() => setPeriod(option)}
            className={cn(
              "px-3 h-8 rounded text-[13px] transition-colors",
              period === option ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
            )}
          >
            {t(option === "monthly" ? "landing.pricing.monthly" : "landing.pricing.yearly")}
            {option === "yearly" && (
              <span className={cn("ml-1.5", period === option ? "text-paper/80" : "text-accent")}>
                · {t("landing.pricing.yearlySave")}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4 max-w-[880px]">
        {PLAN_PRICES.map((price) => {
          const copy = COPY[price.id];
          const professional = price.id === "professional";
          return (
            <Card key={price.id} className={cn("flex flex-col", professional && "border-accent")}>
              <h3 className="text-h3">{t(copy.name)}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-serif text-ink" style={{ fontSize: 40, fontWeight: 380 }}>
                  {pounds(period === "monthly" ? price.monthlyPence : price.yearlyPence)}
                </span>
                <span className="text-small">
                  {t(period === "monthly" ? "landing.pricing.perMonth" : "landing.pricing.perYear")}
                </span>
              </div>
              <p className="text-small text-ink-2 mt-1">{t(copy.fee)}</p>
              <p className="text-body mt-3 text-ink-3">{t(copy.blurb)}</p>
              <ul className="mt-5 flex flex-col gap-2 flex-1">
                {professional && (
                  <li className="text-[13px] text-ink-3">{t("landing.pricing.plus")}</li>
                )}
                {(professional ? PROFESSIONAL_EXTRAS : CORE_FEATURES).map((key) => (
                  <li key={key} className="flex items-start gap-2 text-[14px] text-ink-2">
                    <Icon name="check" size={16} className="text-accent mt-0.5" />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <div className="mt-6 [&>a]:block">
                <SignupCta
                  full
                  variant={professional ? "primary" : "secondary"}
                  size="md"
                  label={t("landing.pricing.cta.start")}
                />
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-small mt-4 max-w-[880px]">{t("landing.pricing.note")}</p>
    </Section>
  );
}
