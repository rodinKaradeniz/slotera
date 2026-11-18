"use client";

import Image, { type StaticImageData } from "next/image";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import nextCall from "@/assets/landing/hero-next-call.png";
import trend from "@/assets/landing/hero-trend.png";
import kpi from "@/assets/landing/hero-kpi.png";
import messages from "@/assets/landing/hero-messages.png";
import services from "@/assets/landing/hero-services.png";

/**
 * Real screenshots of single product components (captured by `npm run ui:walk` into
 * `src/assets/landing/`; importing them gives each capture a content-hashed URL, so a new
 * capture is never hidden by the image optimiser's cache). On wide screens they sit loosely
 * overlapped beside the hero copy; smaller screens show two of them under it.
 */
export function HeroShots() {
  const { t } = useI18n();
  return (
    <>
      {/* Positions are percentages of a 520 × 580 stage, so the arrangement scales with the column. */}
      <div className="hidden lg:block relative w-full aspect-[520/580] select-none">
        <Shot placed image={kpi} alt={t("landing.hero.shot.kpi")} sizes="180px" className="left-0 top-0 w-[33%] z-10" />
        <Shot placed image={trend} alt={t("landing.hero.shot.trend")} sizes="380px" className="right-0 top-[3%] w-[69%]" />
        <Shot placed image={nextCall} alt={t("landing.hero.shot.nextCall")} sizes="480px" priority className="-left-[4%] top-[33%] w-[90%] z-20" />
        <Shot placed image={messages} alt={t("landing.hero.shot.messages")} sizes="230px" className="left-[2%] top-[63%] w-[42%] z-10" />
        <Shot placed image={services} alt={t("landing.hero.shot.services")} sizes="280px" paper className="-right-[2%] top-[64%] w-[52%] z-30" />
      </div>
      <div className="lg:hidden mt-12 grid gap-4 max-w-xl">
        <Shot image={nextCall} alt={t("landing.hero.shot.nextCall")} sizes="(min-width: 640px) 576px, 92vw" priority />
        <Shot image={services} alt={t("landing.hero.shot.services")} sizes="(min-width: 640px) 460px, 74vw" paper className="w-4/5 justify-self-end" />
      </div>
    </>
  );
}

function Shot({ image, alt, sizes, className, priority, paper, placed }: {
  image: StaticImageData;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** The booking-page capture has the page's paper colour around its cards. */
  paper?: boolean;
  /** Positioned on the wide-screen stage. */
  placed?: boolean;
}) {
  return (
    <figure
      className={cn(
        "rounded-xl border border-line shadow-3 overflow-hidden",
        paper ? "bg-paper" : "bg-surface",
        placed && "absolute",
        className,
      )}
    >
      <Image src={image} alt={alt} sizes={sizes} priority={priority} className="block w-full h-auto" />
    </figure>
  );
}
