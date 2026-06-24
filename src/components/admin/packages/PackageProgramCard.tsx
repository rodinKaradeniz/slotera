"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import { PACKAGE_KIND, PACKAGE_STATUS } from "@/lib/status-maps";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/text";
import type { PackageProgram } from "@/types/package-program";

type Props = { item: PackageProgram; onClick: () => void };

export function PackageProgramCard({ item, onClick }: Props) {
  const kind = PACKAGE_KIND[item.kind];
  const status = PACKAGE_STATUS[item.status];
  const sessionsLabel =
    item.includedSessionCount != null
      ? plural(item.includedSessionCount, "session")
      : item.durationLabel || "—";

  return (
    <Card
      hover
      onClick={onClick}
      padded={false}
      className="cursor-pointer overflow-hidden flex flex-col"
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Pill tone="neutral" icon={kind.icon}>
              {kind.label}
            </Pill>
            {item.featured && (
              <Pill tone="accent" icon="star">
                Featured
              </Pill>
            )}
          </div>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
        <h3
          className="font-serif text-ink mt-3"
          style={{ fontSize: 20, fontWeight: 400 }}
        >
          {item.name}
        </h3>
        <p className="text-small mt-2 line-clamp-2">{item.description}</p>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-line-soft">
          <Stat
            icon="card"
            label="Price"
            value={formatMoney(item.priceCents, item.currency)}
          />
          <Stat icon="clock" label="Includes" value={sessionsLabel} />
          <Stat
            icon="layers"
            label="Services"
            value={String(item.attachedServiceIds.length)}
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
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-1 text-micro">
        <Icon name={icon} size={12} /> {label}
      </span>
      <span className="text-[14px] font-medium text-ink truncate">{value}</span>
    </div>
  );
}
