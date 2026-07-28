"use client";

import * as React from "react";
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

const PLACEHOLDER = (label: string) => Array.from({ length: 3 }, (_, i) => (
  <p key={i} className="text-body mb-3">
    {label} placeholder paragraph {i + 1}. Lorem ipsum dolor sit amet, consectetur
    adipiscing elit. Quisque ac sapien sit amet enim sodales tincidunt. Etiam
    sed luctus risus, in pellentesque velit. Curabitur a sapien nec turpis
    placerat porta.
  </p>
));

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
          <div className="space-y-6">
            <section>
              <h3 className="text-h3 text-ink mb-3" style={{ fontSize: 18 }}>
                {t("booking.legal.termsHeading")}
              </h3>
              {PLACEHOLDER("Terms")}
            </section>
            <section>
              <h3 className="text-h3 text-ink mb-3" style={{ fontSize: 18 }}>
                {t("booking.legal.privacyHeading")}
              </h3>
              {PLACEHOLDER("Privacy")}
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}
