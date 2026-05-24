import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";

const STEPS = [
  {
    n: "1",
    title: "Define your sessions",
    body: "Set up the services you offer with duration, capacity, and pricing. 1:1 or group — Slotera doesn't care.",
  },
  {
    n: "2",
    title: "Connect your calendar",
    body: "Sync Google, Apple or Outlook. We respect your availability and prevent double-booking automatically.",
  },
  {
    n: "3",
    title: "Share one link",
    body: "Clients pick a slot, pay, and get the meeting link. You see new bookings in your dashboard.",
  },
];

export function HowItWorks() {
  return (
    <Section>
      <SectionHeader
        eyebrow="How it works"
        title="Go from inbox tag-team to a real booking flow in an afternoon."
        maxTitleWidth="44rem"
      />
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            <Card className="flex-1">
              <div
                className="font-serif text-accent leading-none"
                style={{
                  fontSize: "clamp(48px, 5.5vw, 64px)",
                  fontWeight: 360,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.n}
              </div>
              <h3 className="text-h3 mt-4">{s.title}</h3>
              <p className="text-body mt-2 text-ink-3">{s.body}</p>
            </Card>
            {i < STEPS.length - 1 && (
              <div
                className="hidden sm:flex items-center text-ink-4 shrink-0"
                aria-hidden
              >
                <Icon name="chevron-r" size={22} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </Section>
  );
}
