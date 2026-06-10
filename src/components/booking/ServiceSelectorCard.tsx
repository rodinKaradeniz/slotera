"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { gbp } from "@/lib/money";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Service } from "@/types/service";

type Props = {
  service: Service;
  selected: boolean;
  onSelect: () => void;
};

export function ServiceSelectorCard({ service, selected, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <Card
      hover
      selected={selected}
      onClick={onSelect}
      padded={false}
      className="cursor-pointer p-5 flex items-start gap-4"
    >
      <span
        className="mt-1 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors"
        style={{
          width: 18,
          height: 18,
          borderColor: selected ? "var(--accent)" : "var(--line)",
          background: selected ? "var(--accent)" : "transparent",
        }}
      >
        {selected && (
          <Icon name="check" size={10} strokeWidth={3} className="text-white" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className="font-serif text-ink"
            style={{ fontSize: 18, fontWeight: 400, lineHeight: 1.2 }}
          >
            {service.name}
          </h3>
          <span className="text-[15px] font-medium text-ink flex-shrink-0">
            {service.priceCents === 0 ? t("common.free") : gbp(service.priceCents)}
          </span>
        </div>
        <p className="text-small mt-1">{service.description}</p>
        <div className="text-micro mt-2">{service.durationMin} min</div>
      </div>
    </Card>
  );
}
