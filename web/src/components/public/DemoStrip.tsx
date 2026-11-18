"use client";

import * as React from "react";
import { dataSource } from "@/lib/env";
import { Button } from "@/components/ui/Button";
import { useDemoGuide } from "./DemoGuideProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DemoStrip() {
  const { open } = useDemoGuide();
  const { t } = useI18n();

  if (dataSource === "api") return null;
  return (
    <section className="my-6">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* A tonal band in the page's own palette, not a near-black slab in a cream page. */}
        <div className="rounded-lg p-10 sm:p-16 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 bg-accent-soft text-accent-ink border border-[rgba(61,90,61,0.18)]">
          <div className="max-w-2xl">
            <h2
              className="font-serif"
              style={{
                fontSize: "clamp(28px, 3vw, 40px)",
                fontWeight: 380,
                lineHeight: 1.1,
                letterSpacing: "-0.015em",
              }}
            >
              {t("landing.demoStrip.title")}
            </h2>
          </div>
          <Button variant="primary" size="lg" iconRight="arrow-right" onClick={open}>
            {t("landing.cta.openDemo")}
          </Button>
        </div>
      </div>
    </section>
  );
}
