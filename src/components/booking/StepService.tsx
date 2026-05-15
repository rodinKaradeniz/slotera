"use client";

import * as React from "react";
import { ConsultantIntro } from "./ConsultantIntro";
import { ServiceSelectorCard } from "./ServiceSelectorCard";
import { listServices } from "@/services/services.service";
import type { Service } from "@/types/service";
import { Skeleton } from "@/components/ui/Skeleton";

type Props = {
  selected: Service | null;
  onSelect: (s: Service) => void;
};

export function StepService({ selected, onSelect }: Props) {
  const [services, setServices] = React.useState<Service[] | null>(null);

  React.useEffect(() => {
    listServices().then((s) => setServices(s.filter((x) => x.active)));
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] items-start">
      <ConsultantIntro />
      <div className="flex flex-col gap-3">
        {services === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} h={92} className="rounded-lg" />
            ))
          : services.map((s) => (
              <ServiceSelectorCard
                key={s.id}
                service={s}
                selected={selected?.id === s.id}
                onSelect={() => onSelect(s)}
              />
            ))}
      </div>
    </div>
  );
}
