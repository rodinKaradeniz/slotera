"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { useDrawers } from "@/components/drawers/DrawersProvider";

type Props = {
  firstName?: string;
  subtitle?: string;
};

const WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];

export function spell(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

function timeGreeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ firstName = "Lena", subtitle }: Props) {
  const { openBookingDrawer } = useDrawers();

  const date = new Date();
  const dateStr = date
    .toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
  const bookingSlug = firstName.toLowerCase();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-10">
      <div>
        <div className="eyebrow mb-3">{dateStr}</div>
        <h1 className="text-h1 text-ink">
          {timeGreeting(date)},{" "}
          <span className="font-serif italic text-accent">{firstName}</span>.
        </h1>
        {subtitle && (
          <p className="mt-3 text-small text-ink-3">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex items-center gap-3 text-[13px]">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-soft text-accent">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            Booking page live
          </span>
          <a
            href="/booking"
            target="_blank"
            rel="noreferrer"
            className="text-ink-3 hover:text-ink font-mono truncate"
          >
            slotera.app/{bookingSlug}
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/booking" target="_blank" rel="noreferrer">
            <Button
              variant="secondary"
              size="md"
              icon="eye"
              className="whitespace-nowrap"
            >
              View booking page
            </Button>
          </a>
          <Button
            variant="primary"
            size="md"
            icon="plus"
            className="whitespace-nowrap"
            onClick={() => openBookingDrawer()}
          >
            New booking
          </Button>
        </div>
      </div>
    </div>
  );
}
