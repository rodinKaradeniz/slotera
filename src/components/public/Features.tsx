"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const FEATURES: { icon: IconName; titleKey: keyof Messages; bodyKey: keyof Messages }[] = [
  { icon: "calendar", titleKey: "landing.features.calendar.title", bodyKey: "landing.features.calendar.body" },
  { icon: "card", titleKey: "landing.features.payments.title", bodyKey: "landing.features.payments.body" },
  { icon: "shield", titleKey: "landing.features.gdpr.title", bodyKey: "landing.features.gdpr.body" },
  { icon: "video", titleKey: "landing.features.meeting.title", bodyKey: "landing.features.meeting.body" },
  { icon: "bell", titleKey: "landing.features.reminders.title", bodyKey: "landing.features.reminders.body" },
  { icon: "link", titleKey: "landing.features.embed.title", bodyKey: "landing.features.embed.body" },
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
