"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateBusinessSettings, type BusinessSettings } from "@/services/settings.service";
import { dataSource } from "@/lib/env";
import { PanelCard, CheckRow } from "./PanelCard";

export function BusinessPanel({
  business,
  onChange,
}: {
  business: BusinessSettings;
  onChange: (next: BusinessSettings) => void;
}) {
  const { t: uiText } = useI18n();
  const [local, setLocal] = React.useState(business);
  const save = async () => {
    const next = await updateBusinessSettings({
      name: local.name,
      displayName: local.displayName,
      bio: local.bio,
      email: local.email,
      phone: local.phone,
      address: local.address,
      bookingPageUrl: local.bookingPageUrl,
      bookingPageEnabled: local.bookingPageEnabled,
    });
    onChange(next);
  };
  return (
    <PanelCard
      title={uiText("ui.business.profile")}
      hint={uiText("ui.visible.on.your.public.booking.page")}
      onSave={save}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={uiText("ui.business.name")}>
          <Input
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
          />
        </Field>
        <Field label={uiText("ui.display.name")}>
          <Input
            value={local.displayName}
            onChange={(e) => setLocal({ ...local, displayName: e.target.value })}
          />
        </Field>
        <Field label={uiText("ui.bio")} className="sm:col-span-2">
          <Textarea
            value={local.bio}
            rows={3}
            onChange={(e) => setLocal({ ...local, bio: e.target.value })}
          />
        </Field>
        <Field label={uiText("ui.email")}>
          <Input
            value={local.email}
            onChange={(e) => setLocal({ ...local, email: e.target.value })}
          />
        </Field>
        <Field label={uiText("ui.phone")}>
          <Input
            value={local.phone}
            onChange={(e) => setLocal({ ...local, phone: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <CheckRow
            checked={local.bookingPageEnabled}
            onChange={(v) => setLocal({ ...local, bookingPageEnabled: v })}
            label={uiText("ui.accept.new.bookings.on.my.public.page")}
          />
          <p className="text-micro mt-1.5">
            {uiText("ui.switch.off.to.pause.bookings.existing.bookings.are.unaffected")}</p>
        </div>
        {dataSource === "api" ? (
          <Field
            label={uiText("ui.booking.page.link")}
            hint={uiText("ui.share.this.link.with.clients.the.address.is.set.when.the.workspace.is.created")}
            className="sm:col-span-2"
          >
            <ShareLink path={`/book/${local.bookingPageUrl}`} />
          </Field>
        ) : (
          <Field label={uiText("ui.booking.page.url")} className="sm:col-span-2">
            <Input
              value={local.bookingPageUrl}
              onChange={(e) =>
                setLocal({ ...local, bookingPageUrl: e.target.value })
              }
            />
          </Field>
        )}
      </div>
    </PanelCard>
  );
}

export function ShareLink({ path }: { path: string }) {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(uiText("ui.link.copied"));
    } catch {
      toast.error(uiText("ui.couldn.t.copy.the.link"));
    }
  };
  return (
    <div className="flex gap-2">
      <Input value={url} readOnly className="flex-1" />
      <Button variant="secondary" icon="copy" onClick={copy}>
        {uiText("ui.copy")}</Button>
      <a href={path} target="_blank" rel="noreferrer">
        <Button variant="ghost" icon="eye">
          {uiText("ui.open")}</Button>
      </a>
    </div>
  );
}
