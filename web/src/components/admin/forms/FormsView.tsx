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
import { Input } from "@/components/ui/Input";
import { SegGroup } from "@/components/ui/SegGroup";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { FormCard } from "./FormCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { useLoad } from "@/lib/use-load";
import { LoadError } from "@/components/shared/LoadError";
import { Pagination } from "@/components/shared/Pagination";
import { getForm, listFormPage } from "@/services/forms.service";

type StatusFilter = "all" | "active" | "inactive";

export function FormsView() {
  const { t: uiText, lang } = useI18n();
  const { toast } = useToast();
  const { openFormDrawer } = useDrawers();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [offset, setOffset] = React.useState(0);
  const load = React.useCallback((signal?: AbortSignal) => listFormPage({search: query, status, offset}, signal), [query, status, offset]);
  const {data: page, error, reload: refresh, loading} = useLoad(load);
  const forms = page?.items;
  const filtered = forms ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={uiText("ui.forms")}
        description={uiText("ui.reusable.intake.questions.and.acknowledgements.you.attach.to.services")}
        meta={page ? collectionMeta("forms", page.states ?? {}, lang) : uiText("ui.loading")}
        actions={
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => openFormDrawer({ onSaved: refresh })}
          >
            {uiText("ui.new.form")}</Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[220px]">
          <Input
            icon="search"
            placeholder={uiText("ui.search.forms.by.name")}
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

      {error && <LoadError message={error} onRetry={refresh} />}
      {!forms ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        query.trim() || status !== "all" ? (
          <EmptyState icon="search" title={uiText("empty.filtered.title")} body={uiText("empty.filtered.body")} />
        ) : (
          <EmptyState icon="file" title={uiText("empty.forms.title")} body={uiText("empty.forms.body")} />
        )
      ) : (
        <div className="list-rise grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <FormCard
              key={f.id}
              form={f}
              onClick={async () => {
                try {
                  const item = await getForm(f.id);
                  if (!item) { refresh(); return; }
                  openFormDrawer({initial: item, onSaved: refresh, onRemoved: refresh});
                } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
              }}
            />
          ))}
          <Card
            padded
            className="border-dashed border-2 bg-transparent cursor-pointer hover:border-ink-3 transition-colors flex items-center justify-center min-h-[200px]"
            onClick={() => openFormDrawer({ onSaved: refresh })}
          >
            <div className="flex flex-col items-center gap-2 text-ink-3">
              <span className="w-10 h-10 rounded-md bg-paper-2 flex items-center justify-center">
                <Icon name="plus" size={20} />
              </span>
              <span className="text-[14px] font-medium">{uiText("ui.new.form")}</span>
            </div>
          </Card>
        </div>
      )}
      {page && <Pagination total={page.total} offset={offset} onChange={setOffset} loading={loading} />}
    </PageContainer>
  );
}
