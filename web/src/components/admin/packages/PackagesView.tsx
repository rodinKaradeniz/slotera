"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useToast } from "@/components/ui/Toast";
import * as React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { useLoad } from "@/lib/use-load";
import { LoadError } from "@/components/shared/LoadError";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SegGroup } from "@/components/ui/SegGroup";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { PackageCard } from "./PackageCard";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { Pagination } from "@/components/shared/Pagination";
import { getPackage, listPackagePage } from "@/services/packages.service";

type StatusFilter = "all" | "active" | "inactive";

export function PackagesView() {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const { openPackageDrawer } = useDrawers();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");


  const [offset, setOffset] = React.useState(0);
  const load = React.useCallback((signal?: AbortSignal) => listPackagePage({search: query, status, offset}, signal), [query, status, offset]);
  const {data: page, error, reload: refresh, loading} = useLoad(load);
  const items = page?.items;
  const filtered = items ?? [];

  return (
    <PageContainer>
      {error && <LoadError message={error} onRetry={refresh} />}
      <PageHeader
        eyebrow={uiText("ui.catalog")}
        title={uiText("ui.packages")}
        description={uiText("ui.multi.session.offers.ordered.bundles.of.your.services.presentational.for.now.clients.still")}
        meta={page ? String(page.total) : uiText("ui.loading")}
        actions={
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => openPackageDrawer({ onSaved: refresh })}
          >
            {uiText("ui.new.package")}</Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[220px]">
          <Input
            icon="search"
            placeholder={uiText("ui.search.packages")}
            value={query}
            onChange={(e) => {setQuery(e.target.value); setOffset(0);}}
          />
        </div>
        <SegGroup
          value={status}
          onChange={(value) => {setStatus(value); setOffset(0);}}
          options={[
            { value: "all", label: uiText("ui.all") },
            { value: "active", label: uiText("ui.active") },
            { value: "inactive", label: uiText("ui.inactive") },
          ]}
        />
      </div>

      {!items ? (
        <LoadingRows count={4} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PackageCard
              key={p.id}
              item={p}
              onClick={async () => {
                try {
                  const item = await getPackage(p.id);
                  if (!item) { refresh(); return; }
                  openPackageDrawer({initial: item, onSaved: refresh, onRemoved: refresh});
                } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
              }}
            />
          ))}
          <Card
            padded
            className="border-dashed border-2 bg-transparent cursor-pointer hover:border-ink-3 transition-colors flex items-center justify-center min-h-[200px]"
            onClick={() => openPackageDrawer({ onSaved: refresh })}
          >
            <div className="flex flex-col items-center gap-2 text-ink-3">
              <span className="w-10 h-10 rounded-md bg-paper-2 flex items-center justify-center">
                <Icon name="plus" size={20} />
              </span>
              <span className="text-[14px] font-medium">{uiText("ui.new.package")}</span>
            </div>
          </Card>
        </div>
      )}
      {page && <Pagination total={page.total} offset={offset} onChange={setOffset} loading={loading} />}
    </PageContainer>
  );
}
