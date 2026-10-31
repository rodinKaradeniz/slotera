"use client";

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
      title="Business Profile"
      hint="Visible on your public booking page."
      onSave={save}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Business name">
          <Input
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
          />
        </Field>
        <Field label="Display name">
          <Input
            value={local.displayName}
            onChange={(e) => setLocal({ ...local, displayName: e.target.value })}
          />
        </Field>
        <Field label="Bio" className="sm:col-span-2">
          <Textarea
            value={local.bio}
            rows={3}
            onChange={(e) => setLocal({ ...local, bio: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <Input
            value={local.email}
            onChange={(e) => setLocal({ ...local, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={local.phone}
            onChange={(e) => setLocal({ ...local, phone: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <CheckRow
            checked={local.bookingPageEnabled}
            onChange={(v) => setLocal({ ...local, bookingPageEnabled: v })}
            label="Accept new bookings on my public page"
          />
          <p className="text-micro mt-1.5">
            Switch off to pause bookings. Existing bookings are unaffected.
          </p>
        </div>
        {dataSource === "api" ? (
          <Field
            label="Booking page link"
            hint="Share this link with clients. The address is set when the workspace is created."
            className="sm:col-span-2"
          >
            <ShareLink path={`/book/${local.bookingPageUrl}`} />
          </Field>
        ) : (
          <Field label="Booking page URL" className="sm:col-span-2">
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
  const { toast } = useToast();
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };
  return (
    <div className="flex gap-2">
      <Input value={url} readOnly className="flex-1" />
      <Button variant="secondary" icon="copy" onClick={copy}>
        Copy
      </Button>
      <a href={path} target="_blank" rel="noreferrer">
        <Button variant="ghost" icon="eye">
          Open
        </Button>
      </a>
    </div>
  );
}
