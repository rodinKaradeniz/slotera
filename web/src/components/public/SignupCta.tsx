"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ContactModal } from "@/components/public/ContactModal";
import { useI18n } from "@/components/i18n/I18nProvider";
import { appUrl, dataSource, signupOpen } from "@/lib/env";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * The landing page's account call-to-action.
 * - Real app (API mode): sign-up, or the pilot form while sign-up is invite-only.
 * - Mock demo: the real app's pilot form when NEXT_PUBLIC_APP_URL is set (the demo
 *   only links there; it never calls the API), otherwise the contact form.
 */
export function SignupCta({
  label,
  ...buttonProps
}: { label?: string } & Omit<ButtonProps, "onClick" | "children">) {
  const { t } = useI18n();
  const [contactOpen, setContactOpen] = React.useState(false);

  if (dataSource === "api") {
    return signupOpen ? (
      <Link href="/register">
        <Button {...buttonProps}>{label ?? t("landing.cta.startTrial")}</Button>
      </Link>
    ) : (
      <Link href="/pilot">
        <Button {...buttonProps}>{t("landing.cta.joinPilot")}</Button>
      </Link>
    );
  }
  if (appUrl) {
    return (
      <a href={`${appUrl}/pilot`}>
        <Button {...buttonProps}>{t("landing.cta.joinPilot")}</Button>
      </a>
    );
  }
  return (
    <>
      <Button {...buttonProps} onClick={() => setContactOpen(true)}>
        {t("landing.cta.contact")}
      </Button>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
