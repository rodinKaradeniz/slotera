"use client";

import * as React from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useI18n } from "@/components/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  providerBookingTerms?: {
    enabled: boolean;
    content: string;
  };
};

export function LegalModal({ open, onClose, providerBookingTerms }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = React.useState("provider");

  const showProviderContent =
    providerBookingTerms?.enabled && providerBookingTerms.content.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("booking.legal.title")}
      description={t("booking.legal.description")}
      size="lg"
    >
      <div className="flex justify-start mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "provider", label: t("booking.legal.tab.provider") },
            { value: "platform", label: t("booking.legal.tab.platform") },
          ]}
        />
      </div>
      <div className="text-body">
        {tab === "provider" ? (
          showProviderContent ? (
            <p className="text-body whitespace-pre-line">
              {providerBookingTerms!.content}
            </p>
          ) : (
            <p className="text-body">{t("booking.legal.defaultProviderTerms")}</p>
          )
        ) : (
          <div className="flex flex-col gap-3 text-body">
            <p>{t("booking.legal.platformIntro")}</p>
            <p className="flex flex-wrap gap-4">
              <Link href="/terms" target="_blank" className="text-accent underline underline-offset-2">
                {t("booking.legal.termsHeading")}
              </Link>
              <Link href="/privacy" target="_blank" className="text-accent underline underline-offset-2">
                {t("booking.legal.privacyHeading")}
              </Link>
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
