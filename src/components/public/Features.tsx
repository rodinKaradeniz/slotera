"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const FEATURES: { icon: IconName; titleKey: keyof Messages; bodyKey: keyof Messages }[] = [
  { icon: "card", titleKey: "landing.features.bookings.title", bodyKey: "landing.features.bookings.body" },
  { icon: "clipboard", titleKey: "landing.features.forms.title", bodyKey: "landing.features.forms.body" },
  { icon: "eye", titleKey: "landing.features.reservation.title", bodyKey: "landing.features.reservation.body" },
  { icon: "calendar", titleKey: "landing.features.sessions.title", bodyKey: "landing.features.sessions.body" },
  { icon: "globe", titleKey: "landing.features.languages.title", bodyKey: "landing.features.languages.body" },
  { icon: "grid", titleKey: "landing.features.workspace.title", bodyKey: "landing.features.workspace.body" },
];

export function Features() {
  const { t } = useI18n();
  return (
    <Section id="features">
      <SectionHeader
        eyebrow={t("landing.features.eyebrow")}
        title={t("landing.features.title")}
        maxTitleWidth="44rem"
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <Card key={f.titleKey}>
            <span className="inline-flex w-10 h-10 rounded-md bg-accent-soft text-accent items-center justify-center">
              <Icon name={f.icon} size={20} />
            </span>
            <h3 className="text-h3 mt-4">{t(f.titleKey)}</h3>
            <p className="text-body mt-2 text-ink-3">{t(f.bodyKey)}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
