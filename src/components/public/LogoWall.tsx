import * as React from "react";
import { Section } from "./Section";

const LOGOS = [
  "Kintsugi",
  "Reef Capital",
  "Studio ARC",
  "Lambda Co",
  "Noord",
  "Halo Media",
];

export function LogoWall() {
  return (
    <Section className="py-10 sm:py-12 border-y border-line-soft">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="text-small max-w-xs">
          Trusted by 1,200+ independent advisors, coaches and instructors
          across Europe.
        </div>
        <div className="flex-1 flex flex-wrap items-center gap-x-10 gap-y-3 sm:justify-end">
          {LOGOS.map((l) => (
            <span
              key={l}
              className="text-ink-3 text-[14px] font-medium uppercase"
              style={{ letterSpacing: "0.1em" }}
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}
