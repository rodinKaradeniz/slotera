import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Section } from "./Section";

const QUOTES = [
  {
    name: "Mila Ozawa",
    role: "Co-founder · Kintsugi Studio",
    quote:
      "I used to lose half a day every week to scheduling. Slotera collapsed that to a Sunday-night review.",
  },
  {
    name: "Pieter de Vries",
    role: "Creative director · Noord",
    quote:
      "The booking page looks like part of my site. Clients don't even notice the handoff.",
  },
  {
    name: "Sofia Marin",
    role: "Ops lead · Lambda Co",
    quote:
      "Group workshops with capacity and waitlists used to need a CRM. Now it's two clicks.",
  },
];

export function Testimonials() {
  return (
    <Section>
      <div className="eyebrow mb-3">Testimonials</div>
      <h2 className="h-1 max-w-2xl">
        Operators we&apos;ve quietly freed up an afternoon a week.
      </h2>
      <div className="grid md:grid-cols-3 gap-4 mt-10">
        {QUOTES.map((q) => (
          <Card key={q.name}>
            <div className="flex gap-0.5 mb-4 text-warning">
              {[0, 1, 2, 3, 4].map((i) => (
                <Icon key={i} name="star" size={14} />
              ))}
            </div>
            <p className="text-body text-ink-2">&ldquo;{q.quote}&rdquo;</p>
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
