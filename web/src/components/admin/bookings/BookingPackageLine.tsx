"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { listClientPackagePurchases } from "@/services/package-purchases.service";
import type { Booking } from "@/types/booking";

/**
 * "Covered by Strategy Sprint, session 2 of 3" for a booking a package session pays for.
 * The API sends the package in the booking's context; the demo looks it up.
 */
export function BookingPackageLine({ booking }: { booking: Booking }) {
  const { t } = useI18n();
  const purchaseId = booking.packagePurchaseId;
  const knownName = booking.context?.packageName;
  const knownSize = booking.context?.packageSize;
  const known = knownName && knownSize ? { name: knownName, size: knownSize } : null;
  const [looked, setLooked] = React.useState<{ id: string; name: string; size: number } | null>(null);
  React.useEffect(() => {
    if (!purchaseId || knownName) return;
    let live = true;
    listClientPackagePurchases(booking.clientId).then((items) => {
      const found = items.find((item) => item.id === purchaseId);
      if (live && found) setLooked({ id: purchaseId, name: found.packageName, size: found.items.length });
    }, () => undefined);
    return () => { live = false; };
  }, [purchaseId, booking.clientId, knownName]);
  if (!purchaseId || booking.packagePosition === undefined) return null;
  const shown = known ?? (looked?.id === purchaseId ? looked : null);
  if (!shown) return null;
  return (
    <p className="flex items-start gap-2 text-small text-ink-2 pb-3 mb-3 border-b border-line-soft">
      <Icon name="package" size={15} className="mt-0.5 shrink-0 text-ink-3" />
      <Link href={`/admin/clients/${encodeURIComponent(booking.clientId)}`} className="hover:underline">
        {t("booking.package.covered", { name: shown.name, position: booking.packagePosition + 1, total: shown.size })}
      </Link>
    </p>
  );
}
