"use client";
import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormFieldInput } from "@/components/booking/FormFieldInput";
import { listBookingForms, listManagedForms, submitManagedForm, type BookingFormView } from "@/services/booking-forms.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localeForLang } from "@/lib/i18n";
import type { FormAnswer, FormField } from "@/types/form";

export function BookingForms({ bookingId, token }: { bookingId?: string; token?: string }) {
  const { t, lang } = useI18n();
  const [items, setItems] = React.useState<BookingFormView[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    const load = token ? listManagedForms(token) : listBookingForms(bookingId!);
    load.then((value) => { if (active) { setItems(value); setError(null); } })
      .catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [bookingId, token, attempt]);
  if (error) return <Card padded><p role="alert">{error}</p><Button onClick={() => setAttempt(attempt + 1)}>{t("forms.retry")}</Button></Card>;
  if (!items) return <p role="status">{t("forms.loading")}</p>;
  return <section className="space-y-4"><h2 className="text-h3">{t("forms.answers")}</h2>
    {items.length === 0 && <p className="text-small">{t("forms.none")}</p>}
    {items.map((form) => <Card padded key={form.id}><h3 className="text-h3">{form.name}</h3>
      <p className="text-small">{t(form.assignmentKind === "followup" ? "followup.title" : "forms.preparation")}</p>
      {form.responseDeadline && <p className="text-small">{t("forms.respondBy")} {new Intl.DateTimeFormat(localeForLang(lang), {dateStyle:"medium",timeStyle:"short"}).format(new Date(form.responseDeadline))}</p>}
      {form.submittedAt && <p className="text-small">{new Intl.DateTimeFormat(localeForLang(lang), { dateStyle: "medium", timeStyle: "short" }).format(new Date(form.submittedAt))}</p>}
      {form.answers ? <dl className="space-y-3 mt-4">{form.answers.map((answer) => <div key={answer.fieldId}>
        <dt className="font-medium">{form.fields.find((field) => field.id === answer.fieldId)?.label ?? answer.fieldId}</dt>
        <dd className="whitespace-pre-wrap break-words">{typeof answer.value === "boolean" ? t(answer.value ? "booking.field.yes" : "booking.field.no") : Array.isArray(answer.value) ? answer.value.join(", ") : answer.value}</dd>
      </div>)}</dl> : token && form.canSubmit ? <FormEntry form={form} token={token} onSubmitted={setItems} /> : <p className="text-small mt-3">{t("forms.notSubmitted")}</p>}
      {form.answers && token && <p className="text-small mt-4">{t("forms.corrections")}</p>}
    </Card>)}
  </section>;
}

function FormEntry({ form, token, onSubmitted }: { form: BookingFormView; token: string; onSubmitted: (items: BookingFormView[]) => void }) {
  const { t } = useI18n();
  const [answers, setAnswers] = React.useState<FormAnswer[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try { onSubmitted(await submitManagedForm(token, form.id, answers)); }
    catch (err) { setError(err instanceof Error ? err.message : t("forms.failed")); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="space-y-4 mt-4"><p>{form.description}</p>
    {form.fields.map((field) => <FormFieldInput key={field.id} field={field as FormField}
      value={answers.find((a) => a.fieldId === field.id)?.value}
      onChange={(value) => setAnswers((previous) => [...previous.filter((a) => a.fieldId !== field.id), { fieldId: field.id, value }])} />)}
    <p className="text-small">{t("forms.once")}</p>{error && <p role="alert">{error}</p>}
    <Button type="submit" loading={busy}>{t("forms.submit")}</Button>
  </form>;
}
