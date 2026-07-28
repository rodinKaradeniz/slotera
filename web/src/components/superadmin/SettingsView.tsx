"use client";

import * as React from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";

const LEGAL_LINKS = [
  { id: "terms", label: "Terms of service", url: "https://slotera.app/terms" },
  { id: "privacy", label: "Privacy policy", url: "https://slotera.app/privacy" },
  { id: "dpa", label: "Data processing addendum", url: "https://slotera.app/dpa" },
];

const FEATURE_TOGGLES = [
  { id: "groupSessions", label: "Group sessions & waitlists", on: true },
  { id: "customDomain", label: "Custom domains (Team+)", on: false },
  { id: "exportCsv", label: "CSV export on dashboards", on: true },
];

export function SuperadminSettingsView() {
  const [profile, setProfile] = React.useState({
    name: "Slotera",
    supportEmail: "support@slotera.app",
  });
  const [features, setFeatures] = React.useState(
    Object.fromEntries(FEATURE_TOGGLES.map((f) => [f.id, f.on])),
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform"
        title="Settings"
        description="Lightweight platform-level configuration. All values are mocked — changes persist for this session only."
      />

      <div className="flex flex-col gap-6">
        <Card padded>
          <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>
            Platform profile
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Platform name">
              <Input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </Field>
            <Field label="Support email">
              <Input
                value={profile.supportEmail}
                onChange={(e) =>
                  setProfile({ ...profile, supportEmail: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="flex justify-end mt-5 pt-4 border-t border-line-soft">
            <Button variant="primary">Save changes</Button>
          </div>
        </Card>

        <Card padded>
          <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>
            Legal links
          </h3>
          <div className="flex flex-col">
            {LEGAL_LINKS.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink">{l.label}</div>
                  <div className="text-small truncate">{l.url}</div>
                </div>
                <Button variant="secondary" size="sm" icon="edit">
                  Edit
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card padded>
          <h3 className="text-h3 text-ink mb-2" style={{ fontSize: 16 }}>
            Pricing plans
          </h3>
          <p className="text-small mb-4">
            Configure Slotera plan tiers, prices, and limits. Wired to{" "}
            <code>src/data/mock/plans.json</code> for now — editing UI is a placeholder.
          </p>
          <Button variant="secondary" icon="card">
            Configure plans
          </Button>
        </Card>

        <Card padded>
          <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>
            Feature flags
          </h3>
          <div className="flex flex-col">
            {FEATURE_TOGGLES.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between py-3 border-b border-line-soft last:border-b-0"
              >
                <div className="text-[14px] text-ink">{f.label}</div>
                <Toggle
                  checked={features[f.id]}
                  onChange={(v) =>
                    setFeatures((prev) => ({ ...prev, [f.id]: v }))
                  }
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
