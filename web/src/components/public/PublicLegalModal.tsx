"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useI18n } from "@/components/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
};

const PLACEHOLDER = (label: string) => Array.from({ length: 3 }, (_, i) => (
  <p key={i} className="text-body mb-3">
    {label} placeholder paragraph {i + 1}. Lorem ipsum dolor sit amet, consectetur
    adipiscing elit. Quisque ac sapien sit amet enim sodales tincidunt. Etiam
    sed luctus risus, in pellentesque velit. Curabitur a sapien nec turpis
    placerat porta.
  </p>
));

export function PublicLegalModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = React.useState("imprint");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("legal.title")}
      description={t("legal.description")}
      size="lg"
    >
      <div className="flex justify-start mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "imprint", label: t("legal.tab.imprint") },
            { value: "privacy", label: t("legal.tab.privacy") },
            { value: "terms", label: t("legal.tab.terms") },
          ]}
        />
      </div>
      <div className="text-body">
        {tab === "imprint" && (
          <div className="space-y-4">
            <p className="text-body">{t("legal.imprint.intro")}</p>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-small">
              <dt className="text-ink-3">{t("legal.imprint.company")}</dt>
              <dd className="text-ink-2">Velora Labs</dd>
              <dt className="text-ink-3">{t("legal.imprint.contact")}</dt>
              <dd className="text-ink-2">hello@slotera.app</dd>
              <dt className="text-ink-3">{t("legal.imprint.responsible")}</dt>
              <dd className="text-ink-2">Velora Labs editorial team</dd>
            </dl>
          </div>
        )}
        {tab === "privacy" && PLACEHOLDER("Privacy")}
        {tab === "terms" && PLACEHOLDER("Terms")}
      </div>
    </Modal>
  );
}
