"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const FEATURES: { icon: IconName; titleKey: keyof Messages; bodyKey: keyof Messages }[] = [
  { icon: "card", titleKey: "landing.features.bookings.title", bodyKey: "landing.features.bookings.body" },
  { icon: "clipboard", titleKey: "landing.features.forms.title", bodyKey: "landing.features.forms.body" },
  { icon: "eye", titleKey: "landing.features.bookingPage.title", bodyKey: "landing.features.bookingPage.body" },
  { icon: "calendar", titleKey: "landing.features.sessions.title", bodyKey: "landing.features.sessions.body" },
  { icon: "globe", titleKey: "landing.features.languages.title", bodyKey: "landing.features.languages.body" },
  { icon: "grid", titleKey: "landing.features.workspace.title", bodyKey: "landing.features.workspace.body" },
];

export function Features() {
  const { t } = useI18n();
  return (
    <Section id="features">
      <SectionHeader
        title={t("landing.features.title")}
        maxTitleWidth="44rem"
      />
      {/* A list, not a grid of identical cards: each row names the feature on the
          left and says what it does on the right. */}
      <dl className="border-t border-line">
        {FEATURES.map((f) => (
          <div
            key={f.titleKey}
            data-reveal
            className="grid gap-2 py-7 border-b border-line md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-10"
          >
            <dt className="flex items-baseline gap-3">
              <Icon name={f.icon} size={18} className="relative top-0.5 shrink-0 text-accent" />
              <span className="text-h3 text-ink">{t(f.titleKey)}</span>
            </dt>
            <dd className="text-body text-ink-2 max-w-[60ch]">{t(f.bodyKey)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
