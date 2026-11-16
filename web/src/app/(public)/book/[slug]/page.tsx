"use client";

import * as React from "react";
import Link from "next/link";
import {useI18n} from "@/components/i18n/I18nProvider";
import { BookingTheme } from "@/components/booking/BookingTheme";
import { useParams } from "next/navigation";
import { PublicBookingFlow } from "@/components/booking/PublicBookingFlow";
import { setPublicWorkspaceSlug } from "@/services/public-booking.service";
import { dataSource } from "@/lib/env";

export default function WorkspaceBookingPage() {
  const {t}=useI18n();
  const { slug } = useParams<{ slug: string }>();
  // Selected during render, not in an effect: the flow's children fetch the
  // workspace in their own effects, which run before this component's.
  setPublicWorkspaceSlug(dataSource === "api" ? slug : null);
  React.useEffect(() => () => setPublicWorkspaceSlug(null), []);
  return <BookingTheme slug={slug}><PublicBookingFlow />{dataSource === "api" && <p className="text-center pb-6"><Link href={`/client/${encodeURIComponent(slug)}/sign-in`}>{t("client.signIn")}</Link></p>}</BookingTheme>;
}
