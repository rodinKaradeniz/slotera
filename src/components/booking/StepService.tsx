"use client";

import * as React from "react";
import { ConsultantIntro } from "./ConsultantIntro";
import { ServiceSelectorCard } from "./ServiceSelectorCard";
import { listServices } from "@/services/services.service";
import type { Service } from "@/types/service";
import type { DemoPersona } from "@/types/demo";
import { Skeleton } from "@/components/ui/Skeleton";

type Props = {
  selected: Service | null;
  onSelect: (s: Service) => void;
  /** Active demo persona — filters services + overrides the intro panel. */
  persona?: DemoPersona | null;
};

export function StepService({ selected, onSelect, persona }: Props) {
  const [services, setServices] = React.useState<Service[] | null>(null);

  React.useEffect(() => {
    listServices().then((all) => {
      let list = all.filter((x) => x.active);
      if (persona) {
        list = persona.serviceIds
          .map((id) => list.find((s) => s.id === id))
          .filter((s): s is Service => Boolean(s));
      }
      setServices(list);
    });
  }, [persona]);

  return (
    <div className="grid gap-12 lg:gap-16 lg:grid-cols-[1fr_1.15fr] lg:items-stretch">
      <ConsultantIntro
        nameOverride={persona?.displayName}
        titleOverride={persona?.title}
        bioOverride={persona?.bio}
      />
      <div className="flex flex-col gap-3 lg:justify-center lg:max-w-[460px] lg:ml-auto lg:w-full">
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
