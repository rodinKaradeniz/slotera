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
    a: "Stripe (cards) is the default. Manual bank-transfer instructions can be enabled workspace-wide.",
  },
  {
    q: "Can I run group classes or workshops?",
    a: "Yes. Set the session capacity to any number above 1. Slotera handles spots-left and waitlists.",
  },
  {
    q: "Where are you hosted?",
    a: "Slotera is built with UK data protection workflows in mind.",
  },
  {
    q: "Can I embed the booking page on my own site?",
    a: "Yes. You can either link to the hosted booking page or embed it as an iframe. Your colors and fonts come through either way.",
  },
  {
    q: "What happens if a client cancels?",
    a: "Cancellations follow the policy you set on each service. The session frees up automatically and refunds flow through the same processor you used to take payment.",
  },
];

export function FAQ() {
  const [open, setOpen] = React.useState<number | null>(null);
  return (
    <Section>
      <SectionHeader
        eyebrow="FAQ"
        title="Common questions."
        maxTitleWidth="44rem"
      />
      <div className="flex flex-col gap-3">
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
