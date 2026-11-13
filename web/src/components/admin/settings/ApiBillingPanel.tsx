"use client";
import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Pill } from "@/components/ui/Pill";
import { getWorkspaceBilling, requestBillingChange, type WorkspaceBilling } from "@/services/billing.service";
import { formatMoney } from "@/lib/money";
import { billingState } from "@/lib/plans";
import { localeForLang } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Currency } from "@/types/common";

export function ApiBillingPanel() {
 const { t, lang } = useI18n();
 const [billing, setBilling] = React.useState<WorkspaceBilling | null>(null);
 const [interval, setInterval] = React.useState<"monthly" | "yearly">("monthly");
 const [error, setError] = React.useState<string | null>(null);
 const [success, setSuccess] = React.useState(false);
 const [busy, setBusy] = React.useState(false);
 const [attempt, setAttempt] = React.useState(0);
 React.useEffect(() => { let active = true; getWorkspaceBilling().then((value) => { if (active) { setBilling(value); setInterval(value.billingInterval); setError(null); } }).catch((e: Error) => { if (active) setError(e.message); }); return () => { active = false; }; }, [attempt]);
 const request = async (plan: "essentials" | "professional") => { if (busy) return; setBusy(true); setError(null); setSuccess(false); try { await requestBillingChange(plan, interval); setSuccess(true); } catch(e) { setError(e instanceof Error ? e.message : t("forms.failed")); } finally { setBusy(false); } };
 const state = billing ? billingState(billing.trialEndsAt, billing.paidThrough ?? null) : null;
 const date = state?.kind === "trial" ? state.endsISO : state?.kind === "paid" ? `${state.through}T12:00:00` : null;
 return <div className="space-y-4">{error && <Card padded><p role="alert">{error}</p>{!billing && <Button onClick={() => setAttempt(attempt + 1)}>{t("forms.retry")}</Button>}</Card>}
 {!billing ? !error && <p role="status">{t("billing.loading")}</p> : <>
 <Card padded><h3 className="text-h3">{billing.plan === "professional" ? "Professional" : "Essentials"}</h3><p>{t(billing.billingInterval === "yearly" ? "billing.yearly" : "billing.monthly")}</p>
 <Pill tone={state?.kind === "paid" ? "success" : "warning"}>{t(state?.kind === "trial" ? "billing.trial" : state?.kind === "paid" ? "billing.paid" : "billing.due")}{date && ` · ${new Intl.DateTimeFormat(localeForLang(lang), { dateStyle: "medium" }).format(new Date(date))}`}</Pill><p className="text-small mt-3">{t("billing.manual")}</p></Card>
 <Select aria-label={t("billing.interval")} value={interval} onChange={(e) => { setInterval(e.target.value as "monthly" | "yearly"); setSuccess(false); }} options={[{ value: "monthly", label: t("billing.monthly") }, { value: "yearly", label: t("billing.yearly") }]} />
 <div className="grid sm:grid-cols-2 gap-4">{billing.plans.map((plan) => <Card padded key={plan.id}><h3 className="text-h3">{plan.name}</h3><p className="text-h2 mt-3">{formatMoney(interval === "monthly" ? plan.monthlyPriceCents : plan.yearlyPriceCents, plan.currency as Currency, lang)}</p>
 <p className="text-small mt-3">{t("billing.cardFee", { fee: plan.cardFeeBps / 100 })}</p>
 <Button className="mt-4" disabled={busy || success || (billing.plan === plan.id && billing.billingInterval === interval)} onClick={() => request(plan.id)}>{t("billing.request")}</Button></Card>)}</div>
 {success && <p role="status">{t("billing.received")}</p>}
 </>}
 </div>;
}
