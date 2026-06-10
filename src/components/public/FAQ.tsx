"use client";

import * as React from "react";
import { AccordionItem } from "@/components/ui/Accordion";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const ITEMS: { qKey: keyof Messages; aKey: keyof Messages }[] = [
  { qKey: "landing.faq.q1.q", aKey: "landing.faq.q1.a" },
  { qKey: "landing.faq.q2.q", aKey: "landing.faq.q2.a" },
  { qKey: "landing.faq.q3.q", aKey: "landing.faq.q3.a" },
  { qKey: "landing.faq.q4.q", aKey: "landing.faq.q4.a" },
  { qKey: "landing.faq.q5.q", aKey: "landing.faq.q5.a" },
  { qKey: "landing.faq.q6.q", aKey: "landing.faq.q6.a" },
];

export function FAQ() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState<number | null>(null);
  return (
    <Section>
      <SectionHeader
        eyebrow={t("landing.faq.eyebrow")}
        title={t("landing.faq.title")}
        maxTitleWidth="44rem"
      />
      <div className="flex flex-col gap-3">
        {ITEMS.map((it, i) => (
          <AccordionItem
            key={i}
            open={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
            header={
              <span className="text-[15px] font-medium text-ink">
                {t(it.qKey)}
              </span>
            }
          >
            <div className="px-5 py-4 text-body">{t(it.aKey)}</div>
          </AccordionItem>
        ))}
      </div>
    </Section>
  );
}
