"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Section } from "./Section";
import { HeroCollage } from "./HeroCollage";
import { useDemoGuide } from "./DemoGuideProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

export function Hero() {
  const { open } = useDemoGuide();
  const { t } = useI18n();

  return (
    <Section
      className="pt-14 pb-20 sm:pt-28 sm:pb-32"
      containerClassName="relative"
    >
      <div className="max-w-3xl relative z-10">
        <div className="eyebrow mb-5">{t("landing.hero.eyebrow")}</div>
        <h1 className="text-display text-ink">{t("landing.hero.title")}</h1>
        <p className="text-body-lg mt-6 max-w-2xl">{t("landing.hero.subtitle")}</p>
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Link href="/register">
            <Button size="lg" iconRight="arrow-right">
              {t("landing.cta.startTrial")}
            </Button>
          </Link>
          <Button size="lg" variant="ghost" onClick={open}>
            {t("landing.cta.tryDemo")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-small">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="check" size={14} className="text-success" />
            {t("landing.hero.badge.noCard")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="check" size={14} className="text-success" />
            {t("landing.hero.badge.cancel")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="shield" size={14} className="text-success" />
            {t("landing.hero.badge.gdpr")}
          </span>
        </div>
      </div>

      <HeroCollage />
    </Section>
  );
}
