"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import { SERVICE_STYLE, LOC_TYPE_META } from "@/lib/status-maps";
import { eur } from "@/lib/money";
import type { Service } from "@/types/service";

type Props = { service: Service; onClick: () => void };

export function ServiceCard({ service, onClick }: Props) {
  const style = SERVICE_STYLE[service.kind];
  const loc = LOC_TYPE_META[service.locationType];
  return (
    <Card
      hover
      onClick={onClick}
      padded={false}
      className="cursor-pointer overflow-hidden flex flex-col"
    >
      <div className="h-2" style={{ background: style.fg }} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-medium"
            style={{ background: style.bg, color: style.fg }}
          >
            {style.label}
          </span>
          <Pill tone={service.active ? "accent" : "neutral"}>
            {service.active ? "Active" : "Inactive"}
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
          <Stat icon="clock" label="Duration" value={`${service.durationMin}m`} />
          <Stat
            icon="card"
            label="Price"
            value={service.priceCents === 0 ? "Free" : eur(service.priceCents)}
          />
          <Stat
            icon="users"
            label="Capacity"
            value={service.capacity === 1 ? "1:1" : `Up to ${service.capacity}`}
          />
        </div>
        <div className="flex items-center gap-1.5 text-micro mt-3">
          <Icon name={loc.icon} size={12} /> {loc.label}
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
