import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  wide?: boolean;
};

export function AuthShell({ children, wide = false }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line-soft">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link
            href="/booking"
            className="text-[13px] text-ink-3 hover:text-ink inline-flex items-center gap-1"
          >
            <Icon name="eye" size={14} /> View public booking page
          </Link>
        </div>
      </header>
      <main
        className={cn(
          "flex-1 flex px-4 py-12",
          wide
            ? "items-start justify-center"
            : "items-center justify-center",
        )}
      >
        <div
          className={cn("w-full", wide ? "max-w-[1100px]" : "max-w-md")}
        >
          {children}
        </div>
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
