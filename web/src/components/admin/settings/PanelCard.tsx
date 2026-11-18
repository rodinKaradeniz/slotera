"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import type { SettingsData } from "@/types/settings";
import { cn } from "@/lib/cn";

export type PanelProps = {
  data: SettingsData;
  onChange: (next: SettingsData) => void;
};

export function PanelCard({
  title,
  hint,
  children,
  onSave,
  dirty,
}: {
  /** Omit when the card's heading would repeat the section title above it. */
  title?: string;
  hint?: string;
  children: React.ReactNode;
  onSave?: () => void | Promise<void>;
  /** When given, Save appears only while there are unsaved changes. */
  dirty?: boolean;
}) {
  const { t: uiText } = useI18n();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const save = async () => {
    if (!onSave || saving) return;
    setSaving(true); setError(null);
    try {await onSave();} catch (cause) {setError(cause instanceof Error ? cause : new Error(uiText("errors.unexpected")));}
    finally {setSaving(false);}
  };
  return (
    <Card padded>
      {(title || hint) && (
        <div className="mb-4">
          {title && <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>{title}</h2>}
          {hint && <p className={cn("text-small", title && "mt-1")}>{hint}</p>}
        </div>
      )}
      {children}
      {error && <p role="alert" className="text-small text-danger mt-3">{error.message}</p>}
      {onSave && (
        <div className="collapse-grid" data-state={dirty === false && !saving ? "closed" : "open"} inert={dirty === false && !saving}>
          <div>
            <div className="flex justify-end mt-5 pt-4 border-t border-line-soft">
              <Button variant="primary" loading={saving} onClick={save}>{uiText("ui.save.changes")}</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** A setting that is on or off: the label, with a switch at the end of the row. */
export function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-[14px] text-ink">{label}</span>
      <Toggle checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}
