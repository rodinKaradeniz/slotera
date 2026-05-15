import * as React from "react";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";

type Props = {
  consultantName?: string;
};

export function BookingTopBar({
  consultantName = "Dr. Lena Hartmann",
}: Props) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-line-soft"
      style={{ background: "rgba(244,241,236,0.85)", backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-4">
        <Logo />
        <span className="hidden md:inline-block w-px h-5 bg-line-soft" />
        <span className="hidden md:inline text-[13px] text-ink-2">
          Booking with{" "}
          <span className="text-ink font-medium">{consultantName}</span>
        </span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 text-micro text-ink-3">
          <Icon name="lock" size={12} /> SSL secured · GDPR compliant
        </span>
      </div>
    </header>
  );
}
