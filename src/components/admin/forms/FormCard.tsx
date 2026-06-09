"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import { FORM_PURPOSE, FORM_STATUS } from "@/lib/status-maps";
import { plural } from "@/lib/text";
import type { FormTemplate } from "@/types/form";

type Props = { form: FormTemplate; onClick: () => void };

export function FormCard({ form, onClick }: Props) {
  const status = FORM_STATUS[form.status];
  return (
    <Card
      hover
      onClick={onClick}
      padded={false}
      className="cursor-pointer overflow-hidden flex flex-col"
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <Pill tone="neutral">{FORM_PURPOSE[form.purpose]}</Pill>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
        <h3
          className="font-serif text-ink mt-3"
          style={{ fontSize: 20, fontWeight: 400 }}
        >
          {form.name}
        </h3>
        <p className="text-small mt-2 line-clamp-2">{form.description}</p>
        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-line-soft">
          <Stat
            icon="clipboard"
            label="Fields"
            value={String(form.fields.length)}
          />
          <Stat
            icon="layers"
            label="Attached"
            value={plural(form.attachedServiceIds.length, "service")}
          />
        </div>
      </div>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-micro">
        <Icon name={icon} size={12} /> {label}
      </span>
      <span className="text-[14px] font-medium text-ink">{value}</span>
    </div>
  );
}
