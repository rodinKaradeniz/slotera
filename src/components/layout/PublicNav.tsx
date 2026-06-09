"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { ContactModal } from "@/components/public/ContactModal";
import { DemoGuideButton } from "@/components/public/DemoGuideButton";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";

export function PublicNav() {
  const [contactOpen, setContactOpen] = React.useState(false);
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-line-soft">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-[14px] text-ink-2 ml-6">
          <Link href="#features" className="hover:text-ink">{t("landing.nav.features")}</Link>
          <Link href="#pricing" className="hover:text-ink">{t("landing.nav.pricing")}</Link>
          <Link href="/booking" className="hover:text-ink">{t("landing.nav.liveDemo")}</Link>
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="hover:text-ink"
          >
            {t("landing.nav.contact")}
          </button>
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <DemoGuideButton variant="ghost" className="hidden sm:inline-flex" />
          <Link href="/login">
            <Button variant="ghost" size="md">{t("landing.cta.login")}</Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="md" iconRight="arrow-right">
              {t("landing.cta.startTrial")}
            </Button>
          </Link>
        </div>
      </div>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </header>
  );
}
