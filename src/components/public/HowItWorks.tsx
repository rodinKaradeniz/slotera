import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Section } from "./Section";

const STEPS = [
  {
    n: "01",
    title: "Define your sessions",
    body: "Set up the services you offer with duration, capacity, and pricing. 1:1 or group — Slotera doesn't care.",
  },
  {
    n: "02",
    title: "Connect your calendar",
    body: "Sync Google, Apple or Outlook. We respect your availability and prevent double-booking automatically.",
  },
  {
    n: "03",
    title: "Share one link",
    body: "Clients pick a slot, pay, and get the meeting link. You see new bookings in your dashboard.",
  },
];

export function HowItWorks() {
  return (
    <Section>
      <div className="eyebrow mb-3">How it works</div>
      <h2 className="h-1 max-w-2xl">
        Go from inbox tag-team to a real booking flow in an afternoon.
      </h2>
      <div className="grid sm:grid-cols-3 gap-4 mt-10">
        {STEPS.map((s) => (
          <Card key={s.n}>
            <div className="font-mono text-[12px] text-accent">{s.n}</div>
            <h3 className="h-3 mt-3">{s.title}</h3>
            <p className="text-body mt-2 text-ink-3">{s.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
