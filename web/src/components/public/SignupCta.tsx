"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ContactModal } from "@/components/public/ContactModal";
import { useI18n } from "@/components/i18n/I18nProvider";
import { dataSource } from "@/lib/env";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * The landing page's account call-to-action. Sign-up exists only in the real
 * app (API mode); the mock demo is a showcase, so the same slot opens the
 * contact form instead.
 */
export function SignupCta({
  label,
  ...buttonProps
}: { label?: string } & Omit<ButtonProps, "onClick" | "children">) {
  const { t } = useI18n();
  const [contactOpen, setContactOpen] = React.useState(false);

  if (dataSource === "api") {
    return (
      <Link href="/register">
        <Button {...buttonProps}>{label ?? t("landing.cta.startTrial")}</Button>
      </Link>
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
