"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { plural } from "@/lib/text";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SegGroup } from "@/components/ui/SegGroup";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { FormCard } from "./FormCard";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { listForms } from "@/services/forms.service";
import { FORM_PURPOSE } from "@/lib/status-maps";
import type { FormTemplate } from "@/types/form";

type StatusFilter = "all" | "active" | "inactive";

export function FormsView() {
  const { openFormDrawer } = useDrawers();
  const [forms, setForms] = React.useState<FormTemplate[] | null>(null);
  const [reload, setReload] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  React.useEffect(() => {
    listForms().then(setForms);
  }, [reload]);

  const refresh = () => setReload((k) => k + 1);

  const filtered = (forms ?? []).filter((f) => {
    if (status !== "all" && f.status !== status) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      FORM_PURPOSE[f.purpose].toLowerCase().includes(q)
    );
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalog"
        title="Forms"
        description="Reusable intake questions and acknowledgements you attach to services."
        meta={
          forms
            ? `${plural(forms.length, "form")} · ${
                forms.filter((f) => f.status === "active").length
              } active`
            : "Loading…"
        }
        actions={
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => openFormDrawer({ onSaved: refresh })}
          >
            New form
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[220px]">
          <Input
            icon="search"
            placeholder="Search forms by name or purpose"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <SegGroup
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      {!forms ? (
        <LoadingRows count={4} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <FormCard
              key={f.id}
              form={f}
              onClick={() =>
                openFormDrawer({
                  initial: f,
                  onSaved: refresh,
                  onRemoved: refresh,
                })
              }
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
              <span className="text-[14px] font-medium">New form</span>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
