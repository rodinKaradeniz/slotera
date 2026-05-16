"use client";

import * as React from "react";
import { AccordionItem } from "@/components/ui/Accordion";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";

const ITEMS = [
  {
    q: "Do my clients need an account?",
    a: "No. Clients book and pay as guests. You see them as clients in your dashboard automatically.",
  },
  {
    q: "What payment processors do you support?",
    a: "Stripe (cards) is the default. SEPA bank transfers and PayPal can be enabled per service.",
  },
  {
    q: "Can I run group classes or workshops?",
    a: "Yes. Set the session capacity to any number above 1. Slotera handles spots-left and waitlists.",
  },
  {
    q: "Where are you hosted?",
    a: "Slotera is EU-hosted (Frankfurt) and GDPR-native. We sign a DPA on request and never sell client data.",
  },
];

export function FAQ() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <Section>
      <SectionHeader eyebrow="FAQ" title="Common questions." maxTitleWidth="44rem" />
      <div className="flex flex-col gap-3 max-w-3xl">
        {ITEMS.map((it, i) => (
          <AccordionItem
            key={i}
            open={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
            header={
              <span className="text-[15px] font-medium text-ink">{it.q}</span>
            }
          >
            <div className="px-5 py-4 text-body">{it.a}</div>
          </AccordionItem>
        ))}
      </div>
    </Section>
  );
}
