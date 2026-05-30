"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";

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

const DEFAULT_PROVIDER_TERMS =
  "This provider hasn't set custom booking terms. Standard cancellation and refund expectations apply — please contact the provider directly with any questions.";

export function LegalModal({ open, onClose, providerBookingTerms }: Props) {
  const [tab, setTab] = React.useState("provider");

  const showProviderContent =
    providerBookingTerms?.enabled && providerBookingTerms.content.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Terms and Privacy Policy"
      description="Booking terms set by this provider, plus Slotera's platform terms and privacy notice."
      size="lg"
    >
      <div className="flex justify-start mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "provider", label: "Provider Booking Terms" },
            { value: "platform", label: "Slotera Terms & Privacy" },
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
            <p className="text-body">{DEFAULT_PROVIDER_TERMS}</p>
          )
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="text-h3 text-ink mb-3" style={{ fontSize: 18 }}>
                Terms
              </h3>
              {PLACEHOLDER("Terms")}
            </section>
            <section>
              <h3 className="text-h3 text-ink mb-3" style={{ fontSize: 18 }}>
                Privacy
              </h3>
              {PLACEHOLDER("Privacy")}
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}
