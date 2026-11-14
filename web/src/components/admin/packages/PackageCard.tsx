"use client";
import { translateInterfaceLabel } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/ui/Icon";
import { PACKAGE_STATUS } from "@/lib/status-maps";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/text";
import type { ServicePackage, PackageSummary } from "@/types/package";

type Props = { item: ServicePackage | PackageSummary; onClick: () => void };

export function PackageCard({ item, onClick }: Props) {
  const { t: uiText, lang: labelLang } = useI18n();
  const status = PACKAGE_STATUS[item.status];

  return (
    <Card
      hover
      onClick={onClick}
      padded={false}
      className="cursor-pointer overflow-hidden flex flex-col"
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          {item.featured ? (
            <Pill tone="accent" icon="star">
              {uiText("ui.featured")}</Pill>
          ) : (
            <span />
          )}
          <Pill tone={status.tone}>{translateInterfaceLabel(labelLang, status.label)}</Pill>
        </div>
        <h3
          className="font-serif text-ink mt-3"
          style={{ fontSize: 20, fontWeight: 400 }}
        >
          {item.name}
        </h3>
        <p className="text-small mt-2 line-clamp-2">{item.description}</p>
        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-line-soft">
          <Stat
            icon="card"
            label={uiText("ui.price")}
            value={formatMoney(item.priceCents, item.currency)}
          />
          <Stat
            icon="layers"
            label={uiText("ui.includes")}
            value={plural("itemCount" in item ? item.itemCount : item.items.length, "session")}
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
