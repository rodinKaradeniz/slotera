"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SegGroup } from "@/components/ui/SegGroup";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

type Tier = {
  id: "solo" | "team" | "custom";
  nameKey: keyof Messages;
  price: { monthly: string; yearly: string };
  blurbKey: keyof Messages;
  featureKeys: (keyof Messages)[];
  ctaKey: keyof Messages;
  href: string;
};

const TIERS: Tier[] = [
  {
    id: "solo",
    nameKey: "landing.pricing.solo.name",
    price: { monthly: "£20", yearly: "£15" },
    blurbKey: "landing.pricing.solo.blurb",
    featureKeys: [
      "landing.pricing.solo.f1",
      "landing.pricing.solo.f2",
      "landing.pricing.solo.f3",
      "landing.pricing.solo.f4",
    ],
    ctaKey: "landing.pricing.cta.startTrial",
    href: "/register?plan=solo",
  },
  {
    id: "team",
    nameKey: "landing.pricing.team.name",
    price: { monthly: "£50", yearly: "£40" },
    blurbKey: "landing.pricing.team.blurb",
    featureKeys: [
      "landing.pricing.team.f1",
      "landing.pricing.team.f2",
      "landing.pricing.team.f3",
      "landing.pricing.team.f4",
    ],
    ctaKey: "landing.pricing.cta.startTrial",
    href: "/register?plan=team",
  },
  {
    id: "custom",
    nameKey: "landing.pricing.customTier.name",
    price: { monthly: "Custom", yearly: "Custom" },
    blurbKey: "landing.pricing.customTier.blurb",
    featureKeys: [
      "landing.pricing.customTier.f1",
      "landing.pricing.customTier.f2",
      "landing.pricing.customTier.f3",
      "landing.pricing.customTier.f4",
    ],
    ctaKey: "landing.pricing.cta.talk",
    href: "/#contact",
  },
];

export function Pricing() {
  const { t } = useI18n();
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("yearly");
  return (
    <Section id="pricing">
      <SectionHeader
        eyebrow={t("landing.pricing.eyebrow")}
        title={t("landing.pricing.title")}
        maxTitleWidth="44rem"
        right={
          <SegGroup
            value={cycle}
            onChange={(v) => setCycle(v)}
            options={[
              { value: "monthly", label: t("landing.pricing.monthly") },
              { value: "yearly", label: t("landing.pricing.yearly") },
            ]}
          />
        }
      />
      <div className="grid md:grid-cols-3 gap-4">
        {TIERS.map((tier) => {
          const rawPrice = tier.price[cycle];
          const price = rawPrice === "Custom" ? t("landing.pricing.custom") : rawPrice;
          return (
            <Card key={tier.id} className="flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-h3">{t(tier.nameKey)}</h3>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span
                  className="font-serif text-ink"
                  style={{ fontSize: 40, fontWeight: 380 }}
                >
                  {price}
                </span>
                {rawPrice !== "Custom" && (
                  <span className="text-small">{t("landing.pricing.perMonth")}</span>
                )}
              </div>
              <p className="text-body mt-1 text-ink-3">{t(tier.blurbKey)}</p>
              <ul className="mt-5 flex flex-col gap-2 flex-1">
                {tier.featureKeys.map((fk) => (
                  <li
                    key={fk}
                    className="flex items-start gap-2 text-[14px] text-ink-2"
                  >
                    <Icon name="check" size={16} className="text-accent mt-0.5" />
                    {t(fk)}
                  </li>
                ))}
              </ul>
              <Link href={tier.href} className="mt-6">
                <Button full variant="secondary" size="md">
                  {t(tier.ctaKey)}
                </Button>
              </Link>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
