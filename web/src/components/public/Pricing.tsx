"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { SignupCta } from "./SignupCta";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

// Mirrors the platform plans (docs/PRODUCT.md → Platform billing). The tiers
// share every feature; only the monthly price and the card-payment cut differ.
type Tier = {
  id: "free" | "pro";
  price: string;
  nameKey: keyof Messages;
  blurbKey: keyof Messages;
  feeKey: keyof Messages;
};

const TIERS: Tier[] = [
  {
    id: "free",
    price: "€0",
    nameKey: "landing.pricing.free.name",
    blurbKey: "landing.pricing.free.blurb",
    feeKey: "landing.pricing.free.fee",
  },
  {
    id: "pro",
    price: "€19",
    nameKey: "landing.pricing.pro.name",
    blurbKey: "landing.pricing.pro.blurb",
    feeKey: "landing.pricing.pro.fee",
  },
];

const FEATURE_KEYS: (keyof Messages)[] = [
  "landing.pricing.f1",
  "landing.pricing.f2",
  "landing.pricing.f3",
  "landing.pricing.f4",
];

export function Pricing() {
  const { t } = useI18n();
  return (
    <Section id="pricing">
      <SectionHeader
        eyebrow={t("landing.pricing.eyebrow")}
        title={t("landing.pricing.title")}
        maxTitleWidth="44rem"
      />
      <div className="grid md:grid-cols-2 gap-4 max-w-[880px]">
        {TIERS.map((tier) => (
          <Card key={tier.id} className="flex flex-col">
            <h3 className="text-h3">{t(tier.nameKey)}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-serif text-ink" style={{ fontSize: 40, fontWeight: 380 }}>
                {tier.price}
              </span>
              <span className="text-small">{t("landing.pricing.perMonth")}</span>
            </div>
            <p className="text-small text-ink-2 mt-1">{t(tier.feeKey)}</p>
            <p className="text-body mt-3 text-ink-3">{t(tier.blurbKey)}</p>
            <ul className="mt-5 flex flex-col gap-2 flex-1">
              {FEATURE_KEYS.map((fk) => (
                <li key={fk} className="flex items-start gap-2 text-[14px] text-ink-2">
                  <Icon name="check" size={16} className="text-accent mt-0.5" />
                  {t(fk)}
                </li>
              ))}
            </ul>
            <div className="mt-6 [&>a]:block">
              <SignupCta
                full
                variant={tier.id === "free" ? "primary" : "secondary"}
                size="md"
                label={t("landing.pricing.cta.start")}
              />
            </div>
          </Card>
        ))}
      </div>
      <p className="text-small mt-4">{t("landing.pricing.note")}</p>
    </Section>
  );
}
