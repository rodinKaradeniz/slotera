"use client";

import Link from "next/link";
import { BookingTopBar } from "@/components/layout/BookingTopBar";
import { BookingFooter } from "@/components/layout/BookingFooter";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function FailurePage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col">
      <BookingTopBar />
      <main className="flex-1 max-w-[640px] mx-auto w-full px-6 pt-16 pb-12">
        <Card padded className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#F2DDD8] text-danger flex items-center justify-center mb-5">
            <Icon name="x" size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-h2 text-ink">{t("booking.failure.title")}</h1>
          <p className="text-body mt-2 text-ink-3">{t("booking.failure.body")}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <Link href="/booking">
              <Button variant="primary" icon="arrow-left">
                {t("booking.failure.backToPayment")}
              </Button>
            </Link>
            <Link href="/">
              <Button variant="secondary">{t("booking.failure.cancel")}</Button>
            </Link>
          </div>
        </Card>
      </main>
      <BookingFooter />
    </div>
  );
}
