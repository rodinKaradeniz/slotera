"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import {MessageDigestPreference} from "./MessageDigestPreference";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateSettings } from "@/services/settings.service";
import { changePassword, currentSession } from "@/services/auth.service";
import { PanelProps, PanelCard } from "./PanelCard";

export function ApiAccountPanel() {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const email = currentSession()?.operator.email ?? "";
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;

  const save = async () => {
    if (next.length < 10) {
      toast.error(uiText("ui.your.new.password.needs.at.least.10.characters"));
      return;
    }
    if (next !== confirm) {
      toast.error(uiText("ui.the.new.passwords.don.t.match"));
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(uiText("ui.password.changed"), {
        description: uiText("ui.other.devices.have.been.signed.out"),
      });
    } catch (error) {
      toast.error(uiText("ui.couldn.t.change.your.password"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelCard title={uiText("ui.account")}>
      <div className="flex flex-col gap-4">
        <LanguageSwitcher />
        <MessageDigestPreference />
        <Field label={uiText("ui.account.email")} hint={uiText("ui.contact.us.to.change.the.email.you.sign.in.with")}>
          <Input value={email} readOnly />
        </Field>
        <div className="pt-4 border-t border-line-soft grid sm:grid-cols-3 gap-4">
          <Field label={uiText("ui.current.password")}>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label={uiText("ui.new.password")} hint={uiText("ui.at.least.10.characters")}>
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label={uiText("ui.confirm.new.password")} error={mismatch ? uiText("ui.passwords.don.t.match") : undefined}>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              error={mismatch}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            loading={saving}
            disabled={!current || !next || mismatch}
            onClick={save}
          >
            {uiText("ui.change.password")}</Button>
        </div>
      </div>
    </PanelCard>
  );
}

export function AccountPanel({ data, onChange }: PanelProps) {
  const { t: uiText } = useI18n();
  const [local, setLocal] = React.useState(data.account);
  const save = async () => {
    const next = await updateSettings({ account: local });
    onChange(next);
  };
  return (
    <>
      <PanelCard title={uiText("ui.account")} onSave={save}>
        <LanguageSwitcher />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={uiText("ui.account.email")}>
            <Input
              value={local.email}
              onChange={(e) => setLocal({ ...local, email: e.target.value })}
            />
          </Field>
          <Field label={uiText("ui.workspace.name")}>
            <Input
              value={local.workspaceName}
              onChange={(e) => setLocal({ ...local, workspaceName: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-line-soft">
          <div>
            <div className="text-[14px] font-medium text-ink">{uiText("ui.two.factor.auth")}</div>
            <div className="text-small">
              {local.twoFactorEnabled ? uiText("ui.enabled") : uiText("ui.strongly.recommended")}
            </div>
          </div>
          <Toggle
            checked={local.twoFactorEnabled}
            onChange={(v) => setLocal({ ...local, twoFactorEnabled: v })}
          />
        </div>
      </PanelCard>
      <Card padded>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="alert" size={14} className="text-danger" />
          <h3 className="text-[14px] font-medium text-danger">{uiText("ui.danger.zone")}</h3>
        </div>
        <p className="text-small mb-4">
          {uiText("ui.deleting.your.workspace.removes.all.bookings.clients.and.services.this.cannot.be.undone")}</p>
        <Button variant="danger" size="sm" icon="trash">
          {uiText("ui.delete.workspace")}</Button>
      </Card>
    </>
  );
}
