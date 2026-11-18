"use client";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
export function Pagination({ total, offset, limit = 25, onChange, loading = false }: {total: number; offset: number; limit?: number; onChange: (offset: number) => void; loading?: boolean}) {
  const { t } = useI18n();
  // One page needs no paging controls (unless the list has moved past its first page).
  if (total <= limit && offset === 0) return null;
  return <nav aria-label={t("common.pagination")} className="flex items-center justify-between gap-3 py-4">
    <Button variant="secondary" disabled={loading || offset === 0} aria-label={t("common.back")} onClick={() => onChange(Math.max(0, offset - limit))}>←</Button>
    <span className="text-small">{total ? offset + 1 : 0}–{Math.min(offset + limit, total)} / {total}</span>
    <Button variant="secondary" disabled={loading || offset + limit >= total} aria-label={t("common.continue")} onClick={() => onChange(offset + limit)}>→</Button>
  </nav>;
}
