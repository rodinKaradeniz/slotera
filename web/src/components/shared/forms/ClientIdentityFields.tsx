"use client";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { ClientIdentity } from "@/lib/client-validation";
import type { MessageKey } from "@/i18n/messages/en";
export function ClientIdentityFields({ value, onChange, errors = {} }: {
  value: ClientIdentity;
  onChange: (key: keyof ClientIdentity, value: string) => void;
  errors?: Partial<Record<keyof ClientIdentity, MessageKey>>;
}) {
  const { t } = useI18n();
  return <div className="grid gap-4">{(["name", "email", "phone", "company"] as const).map((key) =>
    <Field key={key} label={t(({ name: "ui.full.name", email: "ui.email", phone: "ui.phone", company: "ui.company" } as const)[key])}
      required={key === "name" || key === "email"} optional={key === "phone" || key === "company"}
      error={errors[key] && t(errors[key])} errorId={`client-${key}-error`}>
      <Input name={key} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
        value={value[key] ?? ""} onChange={(e) => onChange(key, e.target.value)}
        maxLength={key === "email" ? 320 : key === "phone" ? 40 : 160}
        error={!!errors[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `client-${key}-error` : undefined} />
    </Field>)}</div>;
}
