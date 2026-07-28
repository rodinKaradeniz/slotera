"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const QUOTES: { name: string; role: string; quoteKey: keyof Messages }[] = [
  {
    name: "Mila Ozawa",
    role: "Co-founder · Kintsugi Studio",
    quoteKey: "landing.testimonials.q1",
  },
  {
    name: "Pieter de Vries",
    role: "Creative director · Noord",
    quoteKey: "landing.testimonials.q2",
  },
  {
    name: "Sofia Marin",
    role: "Ops lead · Lambda Co",
    quoteKey: "landing.testimonials.q3",
  },
];

export function Testimonials() {
  const { t } = useI18n();
  return (
    <Section>
      <SectionHeader
        eyebrow={t("landing.testimonials.eyebrow")}
        title={t("landing.testimonials.title")}
        maxTitleWidth="44rem"
      />
      <div className="grid md:grid-cols-3 gap-4">
        {QUOTES.map((q) => (
          <Card key={q.name}>
            <div className="flex gap-0.5 mb-4 text-warning">
              {[0, 1, 2, 3, 4].map((i) => (
                <Icon key={i} name="star" size={14} />
              ))}
            </div>
            <p className="text-body text-ink-2">&ldquo;{t(q.quoteKey)}&rdquo;</p>
            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-line-soft">
              <Avatar name={q.name} />
              <div>
                <div className="text-[14px] font-medium text-ink">
                  {q.name}
                </div>
                <div className="text-micro">{q.role}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
