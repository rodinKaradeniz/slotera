"use client";
import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useLoad } from "@/lib/use-load";
import { getForm, listFormPickerPage } from "@/services/forms.service";
import {
  getFollowupRule,
  saveFollowupRule,
  type FollowupRule,
} from "@/services/followups.service";
function Editor({
  initial,
  serviceId,
  version,
  onSaved,
  onError,
}: {
  initial: FollowupRule;
  serviceId: string;
  version: number;
  onSaved: (version: number) => void;
  onError: (error: unknown) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const forms = useLoad(
    React.useCallback(
      (signal?: AbortSignal) => listFormPickerPage(search, offset, signal),
      [search, offset],
    ),
  );
  const selected = useLoad(
    React.useCallback(
      () =>
        draft.formTemplateId
          ? getForm(draft.formTemplateId)
          : Promise.resolve(null),
      [draft.formTemplateId],
    ),
  );
  const options = [
    { value: "", label: t("followup.noForm") },
    ...(forms.data?.items ?? []).map((form) => ({
      value: form.id,
      label: form.name,
    })),
  ];
  if (
    selected.data &&
    !options.some((option) => option.value === selected.data?.id)
  )
    options.push({ value: selected.data.id, label: selected.data.name });
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(false);
    setSaved(false);
    try {
      const { version: _, ...body } = draft;
      const next = await saveFollowupRule(serviceId, body, version);
      setDraft(next);
      onSaved(next.version);
      setSaved(true);
    } catch (error) {
      setError(true);
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="text-h3">{t("followup.title")}</h3>
      <p>{t("followup.ruleHint")}</p>
      <label>
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) =>
            setDraft({ ...draft, enabled: event.target.checked })
          }
        />{" "}
        {t("followup.auto")}
      </label>
      <Field label={t("followup.delay")}>
        <Input
          type="number"
          min={0}
          max={720}
          value={draft.delayHours}
          onChange={(event) =>
            setDraft({ ...draft, delayHours: Number(event.target.value) })
          }
        />
      </Field>
      <Field label={t("followup.message")} optional>
        <Textarea
          maxLength={5000}
          value={draft.message}
          onChange={(event) =>
            setDraft({ ...draft, message: event.target.value })
          }
        />
      </Field>
      <Field label={t("followup.form")} optional group>
        <Input
          aria-label={t("followup.searchForm")}
          placeholder={t("followup.searchForm")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
        />
        <Select
          aria-label={t("followup.form")}
          value={draft.formTemplateId ?? ""}
          options={options}
          onChange={(event) =>
            setDraft({ ...draft, formTemplateId: event.target.value || null })
          }
        />
      </Field>
      {(forms.error || selected.error) && (
        <p role="alert">
          {t("client.failed")}{" "}
          <Button
            onClick={() => {
              forms.reload();
              selected.reload();
            }}
          >
            {t("ui.refresh")}
          </Button>
        </p>
      )}
      <div className="flex justify-between">
        <Button
          size="sm"
          variant="ghost"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          {t("todo.previous")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!forms.data || offset + 20 >= forms.data.total}
          onClick={() => setOffset(offset + 20)}
        >
          {t("todo.next")}
        </Button>
      </div>
      {error && <p role="alert">{t("followup.failed")}</p>}
      {saved && <p role="status">{t("client.saved")}</p>}
      <Button
        variant="secondary"
        onClick={save}
        loading={busy}
        disabled={
          !Number.isInteger(draft.delayHours) ||
          draft.delayHours < 0 ||
          draft.delayHours > 720
        }
      >
        {t("followup.saveRule")}
      </Button>
    </section>
  );
}
export function ServiceFollowupSettings(props: {
  serviceId: string;
  version: number;
  onSaved: (version: number) => void;
  onError: (error: unknown) => void;
}) {
  const { t } = useI18n();
  const load = useLoad(
    React.useCallback(
      (signal?: AbortSignal) => getFollowupRule(props.serviceId, signal),
      [props.serviceId],
    ),
  );
  if (load.error)
    return (
      <p role="alert">
        {t("client.failed")}{" "}
        <Button onClick={load.reload}>{t("ui.refresh")}</Button>
      </p>
    );
  return load.data ? (
    <Editor {...props} initial={load.data} />
  ) : (
    <p role="status">{t("messages.loading")}</p>
  );
}
