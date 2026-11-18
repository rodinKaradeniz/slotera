"use client";

import Image from "next/image";
import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * Real screenshots of the product (captured by `npm run ui:walk` into `public/landing/`):
 * the operator dashboard, with the client booking page laid over its corner on wide
 * screens, and the phone dashboard on small ones.
 */
export function HeroShots() {
  const { t } = useI18n();
  return (
    <div className="relative mt-14 sm:mt-16">
      <figure className="hidden sm:block lg:mr-24 xl:mr-32">
        <div className="rounded-xl border border-line bg-surface shadow-3 overflow-hidden">
          <Image
            src="/landing/hero-dashboard.png"
            width={2848}
            height={1424}
            sizes="(min-width: 1280px) 1040px, 92vw"
            priority
            alt={t("landing.hero.shot.dashboard")}
            className="block w-full h-auto"
          />
        </div>
        <figcaption className="mt-3 text-small text-ink-3">{t("landing.hero.caption.dashboard")}</figcaption>
      </figure>

      <figure className="hidden lg:block absolute right-0 top-[18%] w-[300px] xl:w-[330px]">
        <div className="rounded-xl border border-line bg-paper shadow-3 overflow-hidden p-2">
          <Image
            src="/landing/hero-booking.png"
            width={944}
            height={1016}
            sizes="330px"
            alt={t("landing.hero.shot.booking")}
            className="block w-full h-auto rounded-lg"
          />
        </div>
        <figcaption className="mt-3 text-small text-ink-3">{t("landing.hero.caption.booking")}</figcaption>
      </figure>

      <figure className="sm:hidden mx-auto w-full max-w-[340px]">
        <div className="rounded-[28px] border border-line bg-surface shadow-3 overflow-hidden">
          <Image
            src="/landing/hero-mobile.png"
            width={780}
            height={1400}
            sizes="340px"
            priority
            alt={t("landing.hero.shot.dashboard")}
            className="block w-full h-auto"
          />
        </div>
      </figure>
    </div>
  );
}
