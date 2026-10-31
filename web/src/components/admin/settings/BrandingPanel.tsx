"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { updateSettings } from "@/services/settings.service";
import { PanelProps, PanelCard } from "./PanelCard";

export function BrandingPanel({ data, onChange }: PanelProps) {
  const [local, setLocal] = React.useState(data.branding);
  const save = async () => {
    const next = await updateSettings({ branding: local });
    onChange(next);
  };
  return (
    <PanelCard title="Branding" hint="Used across emails and the booking page." onSave={save}>
      <Field label="Accent color">
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-md border border-line"
            style={{ background: local.accent }}
          />
          <Input
            value={local.accent}
            onChange={(e) => setLocal({ ...local, accent: e.target.value })}
            className="max-w-[180px]"
          />
        </div>
      </Field>
      <Field label="Display font" className="mt-4">
        <Select
          value={local.fontFamily}
          onChange={(e) =>
            setLocal({ ...local, fontFamily: e.target.value as "serif" | "sans" })
          }
          options={[
            { value: "serif", label: "Serif (Fraunces)" },
            { value: "sans", label: "Sans (Inter Tight)" },
          ]}
        />
      </Field>
    </PanelCard>
  );
}
