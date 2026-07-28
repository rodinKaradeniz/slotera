"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { formatMoney } from "@/lib/money";
import { listPackagesForService } from "@/services/packages.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { ServicePackage } from "@/types/package";

/**
 * Informational-only hint shown on the booking Service step when the selected
 * service is included in one or more active packages. There is NO package
 * checkout in Phase 1 — clicking through opens a modal that explains the offers
 * and points the client back to booking a single session. It never alters the
 * step sequence, payment, or what the client books.
 */
type Props = { serviceId: string };

export function PackageOptionsHint({ serviceId }: Props) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<ServicePackage[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listPackagesForService(serviceId).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  if (items.length === 0) return null;

  // Lead with a featured offer when there is one.
  const ordered = [...items].sort(
    (a, b) => Number(!!b.featured) - Number(!!a.featured),
  );

  const meta = (p: ServicePackage) =>
    `${p.items.length} ${t("booking.packages.sessionsSuffix")}`;

  return (
    <>
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-line-soft bg-paper-2 px-4 py-3">
        <span className="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
          <Icon name="layers" size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-ink">
            {t("booking.packages.hintTitle")}
          </div>
          <p className="text-small mt-0.5">{t("booking.packages.hintBody")}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          iconRight="arrow-right"
          onClick={() => setOpen(true)}
          className="shrink-0"
        >
          {t("booking.packages.viewOptions")}
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        title={
          <span className="block">
            <span className="eyebrow block mb-2">
              {t("booking.packages.hintTitle")}
            </span>
            <span
              className="block font-serif text-ink"
              style={{ fontSize: 26, fontWeight: 380, lineHeight: 1.1 }}
            >
              {t("booking.packages.modalTitle")}
            </span>
            <span className="block text-body text-ink-2 mt-3">
              {t("booking.packages.modalBody")}
            </span>
          </span>
        }
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {ordered.map((p) => (
            <div
              key={p.id}
              className="rounded-md border border-line-soft bg-surface-warm p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className="font-serif text-ink"
                      style={{ fontSize: 17, fontWeight: 400 }}
                    >
                      {p.name}
                    </h3>
                    {p.featured && (
                      <Pill tone="accent">{t("booking.packages.featured")}</Pill>
                    )}
                  </div>
                  <p className="text-small mt-1">{p.description}</p>
                  <div className="text-micro mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {meta(p) && <span>{meta(p)}</span>}
                  </div>
                </div>
                <span className="text-[15px] font-medium text-ink shrink-0">
                  {formatMoney(p.priceCents, p.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
