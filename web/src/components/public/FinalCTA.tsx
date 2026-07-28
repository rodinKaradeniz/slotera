"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Section } from "./Section";
import { useDemoGuide } from "./DemoGuideProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

export function FinalCTA() {
  const { open } = useDemoGuide();
  const { t } = useI18n();

  return (
    <Section className="pb-24">
      <div className="rounded-lg border border-line bg-surface-warm p-12 sm:p-20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-10">
        <div className="max-w-2xl">
          <div className="eyebrow mb-3">{t("landing.finalCta.eyebrow")}</div>
          <h2 className="text-h1 text-ink">{t("landing.finalCta.title")}</h2>
          <p className="text-body-lg mt-3 text-ink-3 max-w-md">
            {t("landing.finalCta.body")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/register">
            <Button size="lg" iconRight="arrow-right">
              {t("landing.cta.startTrial")}
            </Button>
          </Link>
          <Button size="lg" variant="ghost" onClick={open}>
            {t("landing.cta.openDemo")}
          </Button>
        </div>
      </div>
    </Section>
  );
}
