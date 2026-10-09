import * as React from "react";
import { Logo } from "@/components/ui/Logo";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * Full-page system state (404, maintenance). Deliberately minimal chrome: these
 * screens render for every audience — public, operator, superadmin — so they
 * carry only the logo, never a role-specific nav.
 */
export function StatusScreen({
  icon,
  eyebrow,
  title,
  body,
  children,
}: {
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line-soft">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center">
          <Logo />
        </div>
      </header>
      <main className="flex-1 max-w-[560px] mx-auto w-full px-6 pt-16 pb-12">
        <Card padded className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-5">
            <Icon name={icon} size={28} />
          </div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-h2 text-ink mt-2">{title}</h1>
          <p className="text-body mt-2 text-ink-3">{body}</p>
          {children && (
            <div className="flex flex-wrap justify-center gap-2 mt-8">{children}</div>
          )}
        </Card>
      </main>
    </div>
  );
}
