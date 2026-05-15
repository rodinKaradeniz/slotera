import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Section } from "./Section";

export function FinalCTA() {
  return (
    <Section className="pb-24">
      <div className="rounded-lg border border-line bg-surface-warm p-10 sm:p-16 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="max-w-xl">
          <h2 className="h-1">Stop chasing slots.</h2>
          <p className="text-body-lg mt-3 text-ink-3">
            Spin up your booking page in under 30 minutes. Free for 14 days, no
            credit card required.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/register">
            <Button size="lg" iconRight="arrow-right">Start free trial</Button>
          </Link>
          <Link href="/booking">
            <Button size="lg" variant="ghost">Open live demo</Button>
          </Link>
        </div>
      </div>
    </Section>
  );
}
