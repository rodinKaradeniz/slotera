"use client";

import * as React from "react";
import Link from "next/link";
import { PublicNav } from "@/components/layout/PublicNav";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useI18n } from "@/components/i18n/I18nProvider";
import { submitPilotApplication, type PilotApplication as Form } from "@/services/platform.service";
import { ApiRequestError } from "@/services/_errors";
import type { MessageKey } from "@/i18n/messages/en";

const BUSINESS_TYPES = ["coaching", "consulting", "fitness", "workshops", "other"] as const;
const VOLUMES = ["under_20", "20_50", "50_150", "over_150"] as const;
const PERKS: MessageKey[] = ["pilot.perk1", "pilot.perk2", "pilot.perk3"];

const EMPTY: Omit<Form, "consent"> & { consent: boolean } = {
  name: "",
  email: "",
  businessName: "",
  businessType: "coaching",
  country: "",
  bookingsPerMonth: "under_20",
  whatsappInterest: false,
  message: "",
  consent: false,
};

/** The pilot waitlist. Applications land in the superadmin Inquiries inbox. */
export function PilotApplication() {
  const { t } = useI18n();
  const [form, setForm] = React.useState(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.consent) return;
    setBusy(true);
    setError(null);
    try {
      await submitPilotApplication({ ...form, consent: true });
      setDone(true);
    } catch (err) {
      setError(
        t(err instanceof ApiRequestError && err.status === 429 ? "pilot.rateLimited" : "pilot.error"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-[1040px] mx-auto w-full px-4 sm:px-6 pt-12 pb-16 grid md:grid-cols-[1fr_1.2fr] gap-10 items-start">
        <div>
          <div className="eyebrow mb-3">{t("pilot.eyebrow")}</div>
          <h1 className="text-h1 text-ink">{t("pilot.title")}</h1>
          <p className="text-body-lg mt-3 text-ink-3">{t("pilot.body")}</p>
          <ul className="mt-6 flex flex-col gap-3">
            {PERKS.map((key) => (
              <li key={key} className="flex items-start gap-2 text-[15px] text-ink-2">
                <Icon name="check" size={16} className="text-accent mt-1" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <Card padded>
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-4">
                <Icon name="check" size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-h2 text-ink">{t("pilot.success.title")}</h2>
              <p className="text-body mt-2 text-ink-3">{t("pilot.success.body")}</p>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={t("pilot.field.name")} required>
                  <Input
                    required
                    maxLength={160}
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label={t("pilot.field.email")} required>
                  <Input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
                <Field label={t("pilot.field.business")} required>
                  <Input
                    required
                    maxLength={160}
                    autoComplete="organization"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  />
                </Field>
                <Field label={t("pilot.field.country")} required>
                  <Input
                    required
                    maxLength={80}
                    autoComplete="country-name"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </Field>
                <Field label={t("pilot.field.businessType")}>
                  <Select
                    value={form.businessType}
                    onChange={(e) =>
                      setForm({ ...form, businessType: e.target.value as Form["businessType"] })
                    }
                    options={BUSINESS_TYPES.map((value) => ({
                      value,
                      label: t(`pilot.type.${value}` as MessageKey),
                    }))}
                  />
                </Field>
                <Field label={t("pilot.field.volume")}>
                  <Select
                    value={form.bookingsPerMonth}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bookingsPerMonth: e.target.value as Form["bookingsPerMonth"],
                      })
                    }
                    options={VOLUMES.map((value) => ({
                      value,
                      label: t(`pilot.volume.${value}` as MessageKey),
                    }))}
                  />
                </Field>
              </div>
              <Field label={t("pilot.field.message")} optional>
                <Textarea
                  rows={3}
                  maxLength={2000}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </Field>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 accent-[color:var(--accent)]"
                  checked={form.whatsappInterest}
                  onChange={(e) => setForm({ ...form, whatsappInterest: e.target.checked })}
                />
                <span className="text-small text-ink-2">{t("pilot.field.whatsapp")}</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5 w-4 h-4 accent-[color:var(--accent)]"
                  checked={form.consent}
                  onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                />
                <span className="text-small text-ink-2">
                  {t("pilot.field.consent")}{" "}
                  <Link href="/privacy" target="_blank" className="underline text-ink">
                    {t("pilot.privacyLink")}
                  </Link>
                </span>
              </label>
              {error && <p className="text-small text-danger">{error}</p>}
              <Button type="submit" variant="primary" iconRight="arrow-right" disabled={busy}>
                {t("pilot.submit")}
              </Button>
            </form>
          )}
        </Card>
      </main>
      <PublicFooter />
    </div>
  );
}
