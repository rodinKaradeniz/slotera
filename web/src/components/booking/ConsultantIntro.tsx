"use client";

import * as React from "react";
import { getSettings } from "@/services/settings.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { SettingsData } from "@/types/settings";
import { dataSource } from "@/lib/env";

type Props = {
  /** Demo-persona overrides. When set, take precedence over workspace settings. */
  nameOverride?: string;
  titleOverride?: string;
  bioOverride?: string;
};

export function ConsultantIntro({
  nameOverride,
  titleOverride,
  bioOverride,
}: Props = {}) {
  const { t } = useI18n();
  const [settings, setSettings] = React.useState<SettingsData | null>(null);

  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  // The demo story fills gaps with Lena's copy; a real workspace shows only
  // what the operator actually entered.
  const demo = dataSource === "mock";
  const name =
    nameOverride ?? settings?.business.displayName ?? (demo ? "Dr. Lena Hartmann" : "");
  const title = titleOverride ?? (demo ? t("booking.intro.title") : "");
  const location = settings?.business.address ?? (demo ? "Berlin" : "");
  const description =
    bioOverride ??
    settings?.business.bio ??
    (demo
      ? "I work with founders on hard strategic decisions — pricing, positioning, and the messy choices between them. Most clients come to me before a fundraise, a pivot, or a launch."
      : "");

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
        {title && <div className="text-small text-ink-2">{title}</div>}
        {location && <div className="text-small text-ink-3">{location}</div>}
      </div>
      {description && <p className="text-body max-w-md">{description}</p>}
    </div>
  );
}
