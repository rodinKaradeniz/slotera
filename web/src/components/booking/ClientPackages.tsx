"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { formatMoney } from "@/lib/money";
import { localeForLang } from "@/lib/i18n";
import type { ClientPackages as ClientPackageList } from "@/services/client-access.service";
import type { Currency } from "@/types/common";

/**
 * The client's packages: sessions left and when the booked ones are. A paid package links
 * to the booking page, where signed-in clients can book with it; a pending one shows how
 * to pay.
 */
export function ClientPackages({ slug, data }: { slug: string; data: ClientPackageList }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const when = (iso: string) =>
    new Intl.DateTimeFormat(localeForLang(lang), { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  return (
    <section className="flex flex-col gap-6">
      {data.items.map((item) => {
        const currency = item.currency as Currency;
        const voided = item.status === "voided";
        const bookable = !voided && item.paymentStatus === "paid" && item.remainingCount > 0;
        return (
          <article key={item.id} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-h3">{item.packageName}</h2>
              <span className="flex-1" />
              {voided ? (
                <Pill>{t("packageSales.voided")}</Pill>
              ) : item.paymentStatus === "paid" ? (
                <Pill tone="success">{t("packageSales.paid")}</Pill>
              ) : (
                <Pill tone="warning">{t("packageSales.awaitingPayment")}</Pill>
              )}
            </div>
            <p className="text-small mt-1 tabular-nums">
              {t("packageSales.used", { used: item.usedCount, total: item.sessions.length })}
              {!voided && <> · {t("packageSales.left", { count: item.remainingCount })}</>}
            </p>
            <ol className="mt-3 grid gap-1.5">
              {item.sessions.map((session) => (
                <li key={session.position} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-2 text-small">
                  <span className="text-ink-3 tabular-nums">{session.position + 1}.</span>
                  <span className="truncate text-ink-2">{session.title}</span>
                  <span className={session.bookedFor ? "tabular-nums" : "text-ink-3"}>
                    {session.bookedFor ? when(session.bookedFor) : t("packageSales.notBooked")}
                  </span>
                </li>
              ))}
            </ol>
            {item.refundedCents > 0 && (
              <p className="text-small mt-3">{t("client.refunded", { amount: formatMoney(item.refundedCents, currency) })}</p>
            )}
            {!voided && item.paymentStatus === "pending" && (
              <div className="mt-4 rounded-lg bg-paper-2 border border-line-soft p-3 text-small">
                <p>{t("client.packages.payBody", { amount: formatMoney(item.priceCents, currency) })}</p>
                {data.manualPaymentInstructions.trim() && (
                  <p className="mt-2 whitespace-pre-line text-ink-2">{data.manualPaymentInstructions}</p>
                )}
              </div>
            )}
            {bookable && (
              <Button size="sm" className="mt-4" onClick={() => router.push(`/book/${encodeURIComponent(slug)}`)}>
                {t("client.packages.book")}
              </Button>
            )}
          </article>
        );
      })}
    </section>
  );
}
