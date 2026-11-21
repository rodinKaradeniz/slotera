"use client";
import { collectionMeta } from "@/lib/collection-meta";
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
import { EmptyState } from "@/components/shared/EmptyState";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { useLoad } from "@/lib/use-load";
import { useLeavingRows } from "@/lib/use-leaving-rows";
import { Pagination } from "@/components/shared/Pagination";
import { getService, listServiceSummaryPage as listServicePage } from "@/services/services.service";

export function ServicesView() {
  const { t: uiText, lang } = useI18n();
  const { toast } = useToast();
  const { openServiceDrawer } = useDrawers();
  const [offset, setOffset] = React.useState(0);
  const load = React.useCallback((signal?: AbortSignal) => listServicePage({offset}, signal), [offset]);
  const {data: page, error, reload: refresh, loading} = useLoad(load);
  const services = page?.items;
  // Only a removed card fades out; a search, filter or page change swaps cards at once.
  const [removedId, setRemovedId] = React.useState<string | null>(null);
  const cards = useLeavingRows(services ?? [], (item) => item.id, (item) => item.id === removedId);
  const removed = (id: string) => { setRemovedId(id); refresh(); };

  return (
    <PageContainer>
      <PageHeader
        title={uiText("ui.services")}
        description={uiText("ui.the.templates.clients.can.book.duration.pricing.and.capacity")}
        meta={page ? collectionMeta("services", page.states ?? {}, lang) : uiText("ui.loading")}
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
      ) : cards.length === 0 ? (
        <EmptyState icon="layers" title={uiText("empty.services.title")} body={uiText("empty.services.body")} />
      ) : (
        <div className="list-rise grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ item: s, leaving }) => (
            <div key={s.id} className="card-shell" data-state={leaving ? "closed" : "open"} inert={leaving}>
              <ServiceCard
                service={s}
                onClick={async () => {
                  try {
                    const item = await getService(s.id);
                    if (!item) { refresh(); return; }
                    openServiceDrawer({initial: item, onSaved: refresh, onRemoved: removed});
                  } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
                }}
              />
            </div>
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
