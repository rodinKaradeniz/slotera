import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Section } from "./Section";
import { HeroCollage } from "./HeroCollage";

export function Hero() {
  return (
    <Section
      className="pt-14 pb-20 sm:pt-28 sm:pb-32"
      containerClassName="relative"
    >
      <div className="max-w-3xl relative z-10">
        <div className="eyebrow mb-5">For consultants, coaches & instructors</div>
        <h1 className="text-display text-ink">
          Paid bookings, without the calendar chaos.
        </h1>
        <p className="text-body-lg mt-6 max-w-2xl">
          Slotera handles your reservation flow end-to-end — services, sessions,
          payments, calendars, reminders — so you stop running it from
          spreadsheets.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Link href="/register">
            <Button size="lg" iconRight="arrow-right">
              Start free trial
            </Button>
          </Link>
          <Link href="/booking">
            <Button size="lg" variant="ghost">
              Try the live demo
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-small">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="check" size={14} className="text-success" />
            No credit card required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="check" size={14} className="text-success" />
            Cancel anytime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="shield" size={14} className="text-success" />
            UK GDPR-aware
          </span>
        </div>
      </div>

      <HeroCollage />
    </Section>
  );
}
