import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { DemoGuideButton } from "@/components/public/DemoGuideButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/cn";

type Size = "default" | "wide" | "medium";

type Props = {
  children: React.ReactNode;
  size?: Size;
};

const WIDTHS: Record<Size, string> = {
  default: "max-w-md",
  medium: "max-w-2xl",
  wide: "max-w-[1100px]",
};

export function AuthShell({ children, size = "default" }: Props) {
  const isWide = size !== "default";
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line-soft">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-4">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <DemoGuideButton variant="link" />
            <Link
              href="/booking"
              className="text-[13px] text-ink-3 hover:text-ink inline-flex items-center gap-1"
            >
              <Icon name="eye" size={14} /> View public booking page
            </Link>
          </div>
        </div>
      </header>
      <main
        className={cn(
          "flex-1 flex px-4 py-12",
          isWide
            ? "items-start justify-center"
            : "items-center justify-center",
        )}
      >
        <div className={cn("w-full", WIDTHS[size])}>{children}</div>
      </main>
      <footer className="border-t border-line-soft">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-micro">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="lock" size={12} /> Operator workspace · UK GDPR-aware
          </span>
          <span className="flex items-center gap-4">
            <Link href="#" className="hover:text-ink">Imprint</Link>
            <Link href="#" className="hover:text-ink">Privacy</Link>
            <Link href="#" className="hover:text-ink">Help</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
