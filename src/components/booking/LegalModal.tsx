"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";

type Props = {
  open: boolean;
  onClose: () => void;
};

const PLACEHOLDER = (label: string) => Array.from({ length: 4 }, (_, i) => (
  <p key={i} className="text-body mb-3">
    {label} placeholder paragraph {i + 1}. Lorem ipsum dolor sit amet, consectetur
    adipiscing elit. Quisque ac sapien sit amet enim sodales tincidunt. Etiam
    sed luctus risus, in pellentesque velit. Curabitur a sapien nec turpis
    placerat porta.
  </p>
));

export function LegalModal({ open, onClose }: Props) {
  const [tab, setTab] = React.useState("terms");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Terms and Privacy Policy"
      description="Combined terms of service and privacy notice for bookings made through Slotera."
      size="lg"
    >
      <div className="flex justify-start mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "terms", label: "Terms" },
            { value: "privacy", label: "Privacy" },
          ]}
        />
      </div>
      <div className="text-body">
        {tab === "terms" ? PLACEHOLDER("Terms") : PLACEHOLDER("Privacy")}
      </div>
    </Modal>
  );
}
