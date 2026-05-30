"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";

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
  const [tab, setTab] = React.useState("imprint");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Legal"
      description="Imprint, privacy notice, and terms of service for the Slotera demo."
      size="lg"
    >
      <div className="flex justify-start mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "imprint", label: "Imprint" },
            { value: "privacy", label: "Privacy" },
            { value: "terms", label: "Terms" },
          ]}
        />
      </div>
      <div className="text-body">
        {tab === "imprint" && (
          <div className="space-y-4">
            <p className="text-body">
              Slotera is a product by <strong className="text-ink">Velora Labs</strong>.
              This is a demo environment — the imprint below is a placeholder
              while the product is in development.
            </p>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-small">
              <dt className="text-ink-3">Company</dt>
              <dd className="text-ink-2">Velora Labs</dd>
              <dt className="text-ink-3">Contact</dt>
              <dd className="text-ink-2">hello@slotera.app</dd>
              <dt className="text-ink-3">Responsible</dt>
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
