"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ContactModal } from "@/components/public/ContactModal";
import { PublicLegalModal } from "@/components/public/PublicLegalModal";
import { useDemoGuide } from "@/components/public/DemoGuideProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

type FooterLink = { label: string; href?: string; onClick?: () => void };

export function PublicFooter() {
  const [contactOpen, setContactOpen] = React.useState(false);
  const [legalOpen, setLegalOpen] = React.useState(false);
  const { open: openDemoGuide } = useDemoGuide();
  const { t } = useI18n();

  return (
    <footer className="border-t border-line-soft bg-paper">
      <div className="max-w-[1200px] mx-auto px-6 py-12 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="text-small mt-3 max-w-sm">{t("footer.tagline")}</p>
        </div>
        <FooterCol
          title={t("footer.col.product")}
          links={[
            { label: t("landing.nav.features"), href: "#features" },
            { label: t("landing.nav.pricing"), href: "#pricing" },
            // Demo-intent link opens the shared Demo Guide modal rather than
            // navigating straight to /booking.
            { label: t("footer.link.demo"), onClick: openDemoGuide },
          ]}
        />
        <FooterCol
          title={t("footer.col.company")}
          links={[{ label: t("landing.nav.contact"), onClick: () => setContactOpen(true) }]}
        />
        <FooterCol
          title={t("footer.col.legal")}
          links={[{ label: t("footer.link.legal"), onClick: () => setLegalOpen(true) }]}
        />
      </div>
      <div className="border-t border-line-soft">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between text-micro">
          <span>{t("footer.copyright")}</span>
          <span>{t("footer.gdpr")}</span>
        </div>
      </div>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <PublicLegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: FooterLink[];
}) {
  return (
    <div>
      <div className="eyebrow mb-3">{title}</div>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.onClick ? (
              <button
                type="button"
                onClick={l.onClick}
                className="text-[14px] text-ink-2 hover:text-ink text-left"
              >
                {l.label}
              </button>
            ) : (
              <Link
                href={l.href ?? "#"}
                className="text-[14px] text-ink-2 hover:text-ink"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
