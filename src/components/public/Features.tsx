import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "calendar",
    title: "Smart calendar sync",
    body: "Two-way sync with Google, Apple, Outlook. Buffers and time zones handled.",
  },
  {
    icon: "card",
    title: "Stripe-grade payments",
    body: "Take cards or manual bank transfer. Issue invoices and refunds without leaving the app.",
  },
  {
    icon: "shield",
    title: "UK GDPR-aware",
    body: "Built with UK data protection workflows in mind. Consent receipts, retention controls, DPA on request.",
  },
  {
    icon: "video",
    title: "Built-in meeting links",
    body: "Auto-generate Zoom or Meet links. Or use a physical address for in-person.",
  },
  {
    icon: "bell",
    title: "Reminders that land",
    body: "Smart email + SMS reminders cut no-shows by 38% on average.",
  },
  {
    icon: "link",
    title: "Embeddable & branded",
    body: "Drop the booking page on your site or use the hosted URL. Your colors, your fonts.",
  },
];

export function Features() {
  return (
    <Section id="features">
      <SectionHeader
        eyebrow="Features"
        title="Everything a solo operator needs. Nothing they don't."
        maxTitleWidth="44rem"
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <span className="inline-flex w-10 h-10 rounded-md bg-accent-soft text-accent items-center justify-center">
              <Icon name={f.icon} size={20} />
            </span>
            <h3 className="text-h3 mt-4">{f.title}</h3>
            <p className="text-body mt-2 text-ink-3">{f.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
