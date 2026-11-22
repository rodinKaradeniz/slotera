"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { formatMoney } from "@/lib/money";
import { listPackagesForService } from "@/services/packages.service";
import { requestPackage, type PackageRequest } from "@/services/package-purchases.service";
import { getSettings } from "@/services/settings.service";
import { useLoad } from "@/lib/use-load";
import { useI18n } from "@/components/i18n/I18nProvider";
import { BuyPackageDone, BuyPackageForm, EMPTY_BUYER, buyerReady, type BuyerDraft } from "./BuyPackage";
import type { PackageOffer } from "@/services/packages.service";

/**
 * Shown on the booking Service step when the selected service is part of active packages.
 * The modal lists the offers; a visitor can request one and pay by bank transfer (the
 * consultant marks it paid), then book its sessions after signing in. It never changes the
 * single-session booking in progress.
 */
type Props = { serviceId: string };

export function PackageOptionsHint({ serviceId }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const load = React.useCallback(async () => {
    const [offers, settings] = await Promise.all([listPackagesForService(serviceId), getSettings()]);
    return { offers, settings };
  }, [serviceId]);
  const { data, error, loading, reload } = useLoad(load);
  const [buying, setBuying] = React.useState<PackageOffer | null>(null);
  const [buyer, setBuyer] = React.useState<BuyerDraft>(EMPTY_BUYER);
  const [key, setKey] = React.useState(() => crypto.randomUUID());
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<PackageRequest | null>(null);
  const items = loading ? [] : data?.offers ?? [];
  if (error) return <div role="alert" className="mt-4 text-small">{error} <Button variant="ghost" onClick={reload}>{t("forms.retry")}</Button></div>;

  if (items.length === 0) return null;

  const settings = data?.settings;
  const provider = settings?.business.displayName ?? "";
  // A free package needs no payment; a paid one needs the consultant's manual payments.
  const canBuy = (offer: PackageOffer) => offer.priceCents === 0 || !!settings?.payments.manualPaymentEnabled;

  // Lead with a featured offer when there is one.
  const ordered = [...items].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));

  const meta = (p: PackageOffer) => `${p.items.length} ${t("booking.packages.sessionsSuffix")}`;

  const close = () => {
    if (busy) return;
    setOpen(false); setBuying(null); setDone(null); setFailure(null);
  };
  const startBuying = (offer: PackageOffer) => {
    setBuying(offer); setBuyer(EMPTY_BUYER); setKey(crypto.randomUUID()); setFailure(null);
  };
  const submit = async () => {
    if (!buying || !buyerReady(buyer)) return;
    setBusy(true);
    setFailure(null);
    try {
      setDone(await requestPackage(buying.id, buyer, key));
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : t("booking.packages.buyFailed"));
    } finally {
      setBusy(false);
    }
  };

  const heading = done
    ? t("booking.packages.requestedTitle")
    : buying
      ? t("booking.packages.buyTitle", { name: buying.name })
      : t("booking.packages.modalTitle");

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
        onClose={close}
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
              {heading}
            </span>
            {!buying && !done && (
              <span className="block text-body text-ink-2 mt-3">
                {items.some(canBuy) ? t("booking.packages.buyIntro") : t("packages.arrange")}
              </span>
            )}
          </span>
        }
        footer={
          done || !buying ? (
            <Button variant="primary" onClick={close}>
              {t("common.close")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setBuying(null)} disabled={busy}>
                {t("booking.back")}
              </Button>
              <Button onClick={submit} loading={busy} disabled={!buyerReady(buyer) || busy}>
                {t("booking.packages.buySubmit")}
              </Button>
            </>
          )
        }
      >
        {done ? (
          <BuyPackageDone result={done} provider={provider} />
        ) : buying ? (
          <>
            <BuyPackageForm offer={buying} provider={provider} terms={settings?.payments.bookingTerms}
              buyer={buyer} onChange={setBuyer} />
            {failure && <p role="alert" className="mt-4 text-small text-danger">{failure}</p>}
          </>
        ) : (
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
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[15px] font-medium text-ink">
                      {formatMoney(p.priceCents, p.currency)}
                    </span>
                    {canBuy(p) && (
                      <Button size="sm" variant="secondary" onClick={() => startBuying(p)}>
                        {t("booking.packages.buy")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
