"use client";

import * as React from "react";
import { Section } from "./Section";
import { useI18n } from "@/components/i18n/I18nProvider";

const LOGOS = [
  "Kintsugi",
  "Reef Capital",
  "Studio ARC",
  "Lambda Co",
  "Noord",
  "Halo Media",
];

export function LogoWall() {
  const { t } = useI18n();
  const track = [...LOGOS, ...LOGOS];
  return (
    <Section className="py-10 sm:py-12 border-y border-line-soft">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="text-small max-w-xs shrink-0">
          {t("landing.logos.trustedBy")}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <div
            className="absolute inset-y-0 left-0 w-12 pointer-events-none z-10"
            style={{
              background:
                "linear-gradient(to right, var(--paper), transparent)",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 w-12 pointer-events-none z-10"
            style={{
              background:
                "linear-gradient(to left, var(--paper), transparent)",
            }}
            aria-hidden
          />
          <ul
            className="marquee-track flex items-center gap-x-10 w-max"
            aria-label="Trusted by"
          >
            {track.map((l, i) => (
              <li
                key={`${l}-${i}`}
                className="text-ink-3 text-[14px] font-medium uppercase whitespace-nowrap"
                style={{ letterSpacing: "0.1em" }}
                aria-hidden={i >= LOGOS.length || undefined}
              >
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
