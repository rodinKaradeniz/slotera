"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const STEPS: { n: string; titleKey: keyof Messages; bodyKey: keyof Messages }[] = [
  { n: "1", titleKey: "landing.how.step1.title", bodyKey: "landing.how.step1.body" },
  { n: "2", titleKey: "landing.how.step2.title", bodyKey: "landing.how.step2.body" },
  { n: "3", titleKey: "landing.how.step3.title", bodyKey: "landing.how.step3.body" },
];

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <Section>
      <SectionHeader
        eyebrow={t("landing.how.eyebrow")}
        title={t("landing.how.title")}
        maxTitleWidth="44rem"
      />
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            <Card className="flex-1">
              <div
                className="font-serif text-accent leading-none"
                style={{
                  fontSize: "clamp(48px, 5.5vw, 64px)",
                  fontWeight: 360,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.n}
              </div>
              <h3 className="text-h3 mt-4">{t(s.titleKey)}</h3>
              <p className="text-body mt-2 text-ink-3">{t(s.bodyKey)}</p>
            </Card>
            {i < STEPS.length - 1 && (
              <div
                className="hidden sm:flex items-center text-ink-4 shrink-0"
                aria-hidden
              >
                <Icon name="chevron-r" size={22} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </Section>
  );
}
