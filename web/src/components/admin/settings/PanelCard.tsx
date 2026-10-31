"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  onSave?: () => void;
}) {
  return (
    <Card padded>
      <div className="mb-4">
        <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>{title}</h2>
        {hint && <p className="text-small mt-1">{hint}</p>}
      </div>
      {children}
      {onSave && (
        <div className="flex justify-end mt-5 pt-4 border-t border-line-soft">
          <Button variant="primary" onClick={onSave}>Save changes</Button>
        </div>
      )}
    </Card>
  );
}

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
    <label
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer border transition-colors",
        checked ? "bg-accent-soft border-[rgba(61,90,61,0.2)]" : "bg-surface border-line-soft",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[color:var(--accent)]"
      />
      <span className="text-[14px] text-ink">{label}</span>
    </label>
  );
}
