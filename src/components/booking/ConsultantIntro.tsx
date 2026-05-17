"use client";

import * as React from "react";
import { getSettings } from "@/services/settings.service";
import type { SettingsData } from "@/types/settings";

export function ConsultantIntro() {
  const [settings, setSettings] = React.useState<SettingsData | null>(null);

  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const name = settings?.business.displayName ?? "Dr. Lena Hartmann";
  const title = "Strategy advisor";
  const location = settings?.business.address ?? "Berlin";
  const description =
    settings?.business.bio ??
    "I work with founders on hard strategic decisions — pricing, positioning, and the messy choices between them. Most clients come to me before a fundraise, a pivot, or a launch.";

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col items-center text-center gap-5 lg:h-full lg:justify-center lg:py-4">
      <span
        className="rounded-full bg-accent-soft flex items-center justify-center text-accent-ink font-serif"
        style={{ width: 140, height: 140, fontSize: 44 }}
        aria-label={name}
      >
        {initials}
      </span>
      <div className="flex flex-col gap-1.5">
        <h2
          className="font-serif text-ink"
          style={{
            fontSize: "clamp(26px, 3vw, 32px)",
            fontWeight: 380,
            lineHeight: 1.1,
            letterSpacing: "-0.015em",
          }}
        >
          {name}
        </h2>
        <div className="text-small text-ink-2">{title}</div>
        <div className="text-small text-ink-3">{location}</div>
      </div>
      <p className="text-body max-w-md">{description}</p>
    </div>
  );
}
