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
import { PackageCard } from "./PackageCard";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { listPackages } from "@/services/packages.service";
import type { ServicePackage } from "@/types/package";

type StatusFilter = "all" | "active" | "inactive";

export function PackagesView() {
  const { openPackageDrawer } = useDrawers();
  const [items, setItems] = React.useState<ServicePackage[] | null>(null);
  const [reload, setReload] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  React.useEffect(() => {
    listPackages().then(setItems);
  }, [reload]);

  const refresh = () => setReload((k) => k + 1);

  const filtered = (items ?? []).filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalog"
        title="Packages"
        description="Multi-session offers — ordered bundles of your services. Presentational for now; clients still book individual sessions."
        meta={
          items
            ? `${plural(items.length, "package")} · ${
                items.filter((p) => p.status === "active").length
              } active`
            : "Loading…"
        }
        actions={
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => openPackageDrawer({ onSaved: refresh })}
          >
            New package
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[220px]">
          <Input
            icon="search"
            placeholder="Search packages"
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

      {!items ? (
        <LoadingRows count={4} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PackageCard
              key={p.id}
              item={p}
              onClick={() =>
                openPackageDrawer({
                  initial: p,
                  onSaved: refresh,
                  onRemoved: refresh,
                })
              }
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
              <span className="text-[14px] font-medium">New package</span>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
