"use client";
import * as React from "react";
import type { Branding } from "@/services/branding.service";
import { getPublicBookingWorkspace } from "@/services/public-booking.service";
import { dataSource } from "@/lib/env";

export function brandingStyle(branding?: Branding): React.CSSProperties {
  if (!branding || !/^#[0-9a-f]{6}$/i.test(branding.accent ?? "")) return {};
  return {
    "--accent": branding.accent,
    "--accent-hover": `color-mix(in srgb, ${branding.accent} 80%, black)`,
    "--accent-ink": branding.accent,
    "--accent-soft": `color-mix(in srgb, ${branding.accent} 10%, white)`,
    "--booking-heading-font": branding.fontFamily === "sans" ? "var(--font-sans)" : "'Fraunces Variable', Georgia, serif",
  } as React.CSSProperties;
}

export const BookingThemeContext = React.createContext<React.CSSProperties>({});
export function BookingTheme({ children, slug, branding }: { children: React.ReactNode; slug?: string | null; branding?: Branding }) {
  const [loaded, setLoaded] = React.useState<{ slug: string; branding: Branding } | null>(null);
  React.useEffect(() => {
    if (!slug || dataSource !== "api" || branding) return;
    let active = true;
    getPublicBookingWorkspace(slug).then((workspace) => { if (active && workspace.branding) setLoaded({ slug, branding: workspace.branding }); }).catch(() => undefined);
    return () => { active = false; };
  }, [slug, branding]);
  const style = brandingStyle(branding ?? (loaded && loaded.slug === slug ? loaded.branding : undefined));
  return <BookingThemeContext.Provider value={style}><div className="booking-theme contents" style={style}>{children}</div></BookingThemeContext.Provider>;
}
