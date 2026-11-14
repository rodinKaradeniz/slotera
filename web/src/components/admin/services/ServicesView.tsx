"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useToast } from "@/components/ui/Toast";
import * as React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { ServiceCard } from "./ServiceCard";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { useLoad } from "@/lib/use-load";
import { Pagination } from "@/components/shared/Pagination";
import { getService, listServiceSummaryPage as listServicePage } from "@/services/services.service";

export function ServicesView() {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const { openServiceDrawer } = useDrawers();
  const [offset, setOffset] = React.useState(0);
  const load = React.useCallback((signal?: AbortSignal) => listServicePage({offset}, signal), [offset]);
  const {data: page, error, reload: refresh, loading} = useLoad(load);
  const services = page?.items;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={uiText("ui.catalog")}
        title={uiText("ui.services")}
        description={uiText("ui.the.templates.clients.can.book.duration.pricing.and.capacity")}
        meta={page ? String(page.total) : uiText("ui.loading")}
        actions={
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => openServiceDrawer({ onSaved: refresh })}
          >
            {uiText("ui.new.service")}</Button>
        }
      />

      {error ? (
        <Card padded>
          <p className="text-small text-danger">{error}</p>
        </Card>
      ) : !services ? (
        <LoadingRows count={4} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onClick={async () => {
                try {
                  const item = await getService(s.id);
                  if (!item) { refresh(); return; }
                  openServiceDrawer({initial: item, onSaved: refresh, onRemoved: refresh});
                } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
              }}
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
              <span className="text-[14px] font-medium">{uiText("ui.new.service")}</span>
            </div>
          </Card>
        </div>
      )}
      {page && <Pagination total={page.total} offset={offset} onChange={setOffset} loading={loading} />}
    </PageContainer>
  );
}
