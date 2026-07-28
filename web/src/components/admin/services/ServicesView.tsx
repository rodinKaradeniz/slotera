"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { plural } from "@/lib/text";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { ServiceCard } from "./ServiceCard";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { listServices } from "@/services/services.service";
import type { Service } from "@/types/service";

export function ServicesView() {
  const { openServiceDrawer } = useDrawers();
  const [services, setServices] = React.useState<Service[] | null>(null);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    listServices().then(setServices);
  }, [reload]);

  const refresh = () => setReload((k) => k + 1);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalog"
        title="Services"
        description="The templates clients can book — duration, pricing and capacity."
        meta={
          services
            ? `${plural(services.length, "service")} · ${
                services.filter((s) => s.active).length
              } active`
            : "Loading…"
        }
        actions={
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => openServiceDrawer({ onSaved: refresh })}
          >
            New service
          </Button>
        }
      />

      {!services ? (
        <LoadingRows count={4} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onClick={() =>
                openServiceDrawer({
                  initial: s,
                  onSaved: refresh,
                  onRemoved: refresh,
                })
              }
            />
          ))}
          <Card
            padded
            className="border-dashed border-2 bg-transparent cursor-pointer hover:border-ink-3 transition-colors flex items-center justify-center min-h-[230px]"
            onClick={() => openServiceDrawer({ onSaved: refresh })}
          >
            <div className="flex flex-col items-center gap-2 text-ink-3">
              <span className="w-10 h-10 rounded-md bg-paper-2 flex items-center justify-center">
                <Icon name="plus" size={20} />
              </span>
              <span className="text-[14px] font-medium">New service</span>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
