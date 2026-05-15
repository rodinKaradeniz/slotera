import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-line-soft bg-paper">
      <div className="max-w-[1200px] mx-auto px-6 py-12 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="text-small mt-3 max-w-sm">
            Slotera helps independent advisors and coaches run their reservation
            flow without juggling spreadsheets, calendars and invoices.
          </p>
        </div>
        <FooterCol title="Product" links={[
          { label: "Features", href: "#features" },
          { label: "Pricing", href: "#pricing" },
          { label: "Live demo", href: "/booking" },
        ]} />
        <FooterCol title="Company" links={[
          { label: "About", href: "#" },
          { label: "Blog", href: "#" },
          { label: "Contact", href: "#" },
        ]} />
        <FooterCol title="Legal" links={[
          { label: "Imprint", href: "#" },
          { label: "Privacy", href: "#" },
          { label: "Terms", href: "#" },
        ]} />
      </div>
      <div className="border-t border-line-soft">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between text-micro">
          <span>© 2026 Slotera · Berlin</span>
          <span>EU-hosted · GDPR-native</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="eyebrow mb-3">{title}</div>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-[14px] text-ink-2 hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
