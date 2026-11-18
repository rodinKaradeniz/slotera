"use client";

import * as React from "react";
import { dataSource } from "@/lib/env";
import { Button } from "@/components/ui/Button";
import { Section } from "./Section";
import { HeroShots } from "./HeroShots";
import { SignupCta } from "./SignupCta";
import { useDemoGuide } from "./DemoGuideProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

export function Hero() {
  const { open } = useDemoGuide();
  const { t } = useI18n();

  return (
    <Section className="pt-14 pb-16 sm:pt-24 sm:pb-24">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:gap-12 lg:items-center">
        <div className="max-w-3xl">
          <div className="eyebrow mb-5">{t("landing.hero.eyebrow")}</div>
          <h1 className="text-display text-ink">{t("landing.hero.title")}</h1>
          <p className="text-body-lg mt-6 max-w-2xl">{t("landing.hero.subtitle")}</p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <SignupCta size="lg" iconRight="arrow-right" />
            {dataSource === "mock" && (
              <Button size="lg" variant="ghost" onClick={open}>
                {t("landing.cta.tryDemo")}
              </Button>
            )}
          </div>
        </div>
        <HeroShots />
      </div>
    </Section>
  );
}
