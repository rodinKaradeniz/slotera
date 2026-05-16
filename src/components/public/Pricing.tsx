"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { SegGroup } from "@/components/ui/SegGroup";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";

const TIERS = [
  {
    id: "solo",
    name: "Solo",
    price: { monthly: "€19", yearly: "€15" },
    blurb: "For independent operators getting paid bookings live.",
    features: [
      "Unlimited services",
      "Stripe & SEPA payments",
      "Google / Apple calendar sync",
      "1 booking page",
    ],
    cta: "Start free trial",
  },
  {
    id: "team",
    name: "Team",
    price: { monthly: "€49", yearly: "€39" },
    blurb: "For practices and studios with a small team.",
    features: [
      "Everything in Solo",
      "Up to 5 operators",
      "Group sessions & waitlists",
      "Custom branding",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: { monthly: "Custom", yearly: "Custom" },
    blurb: "For schools, networks and multi-location studios.",
    features: [
      "Everything in Team",
      "Unlimited operators",
      "SSO & audit log",
      "Priority support & DPA",
    ],
    cta: "Talk to us",
  },
];

export function Pricing() {
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("yearly");
  return (
    <Section id="pricing">
      <SectionHeader
        eyebrow="Pricing"
        title="Straightforward pricing. Cancel anytime."
        maxTitleWidth="44rem"
        right={
          <SegGroup
            value={cycle}
            onChange={(v) => setCycle(v)}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly · −20%" },
            ]}
          />
        }
      />
      <div className="grid md:grid-cols-3 gap-4">
        {TIERS.map((t) => (
          <Card
            key={t.id}
            selected={t.highlight}
            className="flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-h3">{t.name}</h3>
              {t.highlight && <Pill tone="accent">Most popular</Pill>}
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span
                className="font-serif text-ink"
                style={{ fontSize: 40, fontWeight: 380 }}
              >
                {t.price[cycle]}
              </span>
              <span className="text-small">/mo</span>
            </div>
            <p className="text-body mt-1 text-ink-3">{t.blurb}</p>
            <ul className="mt-5 flex flex-col gap-2 flex-1">
              {t.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-[14px] text-ink-2"
                >
                  <Icon name="check" size={16} className="text-accent mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-6">
              <Button
                full
                variant={t.highlight ? "primary" : "secondary"}
                size="md"
              >
                {t.cta}
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </Section>
  );
}
