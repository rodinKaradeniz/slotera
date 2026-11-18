"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { updateSettings } from "@/services/settings.service";
import { PanelProps, PanelCard } from "./PanelCard";

export function BrandingPanel({ data, onChange }: PanelProps) {
  const { t: uiText } = useI18n();
  const [local, setLocal] = React.useState(data.branding);
  const save = async () => {
    const next = await updateSettings({ branding: local });
    onChange(next);
  };
  return (
    <PanelCard title={uiText("ui.branding")} hint={uiText("ui.used.across.emails.and.the.booking.page")} onSave={save} dirty={JSON.stringify(local) !== JSON.stringify(data.branding)}>
      <Field label={uiText("ui.accent.color")}>
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
      <Field label={uiText("ui.display.font")} className="mt-4">
        <Select
          value={local.fontFamily}
          onChange={(e) =>
            setLocal({ ...local, fontFamily: e.target.value as "serif" | "sans" })
          }
          options={[
            { value: "serif", label: uiText("ui.serif.fraunces") },
            { value: "sans", label: uiText("ui.sans.inter.tight") },
          ]}
        />
      </Field>
    </PanelCard>
  );
}
