"use client";
import { translateInterfaceLabel } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import { LOC_TYPE_META } from "@/lib/status-maps";
import { formatMoney } from "@/lib/money";
import type { ServiceSummary } from "@/types/service";

type Props = { service: ServiceSummary; onClick: () => void };

export function ServiceCard({ service, onClick }: Props) {
  const { t: uiText, lang: labelLang } = useI18n();
  const loc = LOC_TYPE_META[service.locationType];
  return (
    <Card
      hover
      onClick={onClick}
      padded={false}
      className="cursor-pointer overflow-hidden flex flex-col"
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-end">
          <Pill tone={service.active ? "accent" : "neutral"}>
            {service.active ? uiText("ui.active") : uiText("ui.inactive")}
          </Pill>
        </div>
        <h3
          className="font-serif text-ink mt-3"
          style={{ fontSize: 20, fontWeight: 400 }}
        >
          {service.name}
        </h3>
        <p className="text-small mt-2 line-clamp-2">{service.description}</p>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-line-soft">
          <Stat icon="clock" label={uiText("ui.duration")} value={`${service.durationMin}m`} />
          <Stat
            icon="card"
            label={uiText("ui.price")}
            value={service.priceCents === 0 ? uiText("ui.free") : formatMoney(service.priceCents, service.currency, labelLang)}
          />
          <Stat
            icon="users"
            label={uiText("ui.capacity")}
            value={service.capacity === 1 ? "1:1" : `Up to ${service.capacity}`}
          />
        </div>
        <div className="flex items-center gap-1.5 text-micro mt-3">
          <Icon name={loc.icon} size={12} /> {translateInterfaceLabel(labelLang, loc.label)}
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
