"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SegGroup } from "@/components/ui/SegGroup";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Section } from "./Section";

type Tier = {
  id: "solo" | "team" | "custom";
  name: string;
  price: { monthly: string; yearly: string };
  blurb: string;
  features: string[];
  cta: string;
  href: string;
};

const TIERS: Tier[] = [
  {
    id: "solo",
    name: "Solo",
    price: { monthly: "£20", yearly: "£15" },
    blurb: "For independent operators getting paid bookings live.",
    features: [
      "Unlimited services",
      "Stripe & manual bank-transfer payments",
      "Google / Apple calendar sync",
      "1 booking page",
    ],
    cta: "Start free trial",
    href: "/register?plan=solo",
  },
  {
    id: "team",
    name: "Team",
    price: { monthly: "£50", yearly: "£40" },
    blurb: "For practices and studios with a small team.",
    features: [
      "Everything in Solo",
      "Up to 10 team members",
      "Group sessions & waitlists",
      "Custom branding",
    ],
    cta: "Start free trial",
    href: "/register?plan=team",
  },
  {
    id: "custom",
    name: "Custom",
    price: { monthly: "Custom", yearly: "Custom" },
    blurb: "For schools, networks and multi-location studios.",
    features: [
      "Everything in Team",
      "Unlimited team members",
      "SSO & audit log",
      "Priority support & DPA",
    ],
    cta: "Talk to us",
    href: "/#contact",
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
          <Card key={t.id} className="flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-h3">{t.name}</h3>
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
            <Link href={t.href} className="mt-6">
              <Button full variant="secondary" size="md">
                {t.cta}
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </Section>
  );
}
