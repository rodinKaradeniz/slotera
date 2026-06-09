"use client";

import * as React from "react";
import { ConsultantIntro } from "./ConsultantIntro";
import { ServiceSelectorCard } from "./ServiceSelectorCard";
import { listBookingServices } from "@/services/demo.service";
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
    listBookingServices(persona ?? null).then(setServices);
  }, [persona]);

  return (
    <div className="grid gap-12 lg:gap-16 lg:grid-cols-[1fr_1.15fr] lg:items-stretch">
      <ConsultantIntro
        nameOverride={persona?.displayName}
        titleOverride={persona?.title}
        bioOverride={persona?.bio}
      />
      {/* Outer column centers vertically next to the intro; inner list scrolls
          independently on desktop/tablet when there are many services, so the
          provider intro on the left stays put and the stepper body never
          overflows the viewport. Centering lives on the outer wrapper (not the
          scroll container) to avoid the flexbox justify-center + overflow
          top-clipping bug. On mobile the list flows with normal page scroll. */}
      <div className="flex flex-col lg:justify-center lg:max-w-[460px] lg:ml-auto lg:w-full">
        <div className="flex flex-col gap-3 sm:max-h-[clamp(360px,55vh,560px)] sm:overflow-y-auto sm:pr-1">
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
    </div>
  );
}
