"use client";
import { currencySymbol } from "@/lib/money";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { AddressPicker } from "./AddressPicker";
import { AttachedFormsField } from "./AttachedFormsField";
import { listWorkspaceLocations } from "@/services/settings.service";
import { dataSource } from "@/lib/env";
import type { Service } from "@/types/service";
import { CURRENCIES, type Currency, type LocationType } from "@/types/common";
import type { WorkspaceLocation } from "@/types/address";

/**
 * Controlled fields for a service (everything except IDs and creation timestamp).
 * Used by both `ServiceDrawer` (admin edit/create) and the onboarding stepper
 * (first-service step) so the field set and validation stay in one place.
 *
 * The caller owns state, save plumbing, footer actions, and any danger-zone
 * controls. This component renders fields only.
 */
export type ServiceFormValue = Omit<Service, "id" | "createdAtISO">;

type Props = {
  value: ServiceFormValue;
  onChange: (next: ServiceFormValue) => void;
  /** Hide the active toggle (e.g. during first-time onboarding). */
  showActiveToggle?: boolean;
  /** Saved service id — enables the "Attached forms" section in edit mode. */
  serviceId?: string;
  disabled?: boolean;
};

export function ServiceForm({
  value,
  onChange,
  showActiveToggle = true,
  serviceId,
  disabled,
}: Props) {
  const { t: uiText } = useI18n();
  const [savedLocations, setSavedLocations] = React.useState<WorkspaceLocation[]>(
    [],
  );

  React.useEffect(() => {
    listWorkspaceLocations().then(setSavedLocations).catch((error) => {
      console.error("saved_locations_load_failed", error);
      setSavedLocations([]);
    });
  }, []);

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5 disabled:opacity-90">
      <Field label={uiText("ui.service.name")} required>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={uiText("ui.e.g.strategy.deep.dive")}
        />
      </Field>

      <Field label={uiText("ui.description")} hint={uiText("ui.one.short.line.clients.see.on.the.booking.page")}>
        <Textarea
          value={value.description}
          rows={3}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </Field>

      <Field label={uiText("ui.duration.min")}>
        <Input
          type="number"
          value={String(value.durationMin)}
          onChange={(e) =>
            onChange({ ...value, durationMin: Number(e.target.value) || 0 })
          }
          min={5}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={uiText("ui.price")}>
          <Input
            type="number"
            prefix={currencySymbol(value.currency)}
            value={String(value.priceCents / 100)}
            onChange={(e) =>
              onChange({
                ...value,
                priceCents: Math.round(Number(e.target.value) * 100) || 0,
              })
            }
            min={0}
          />
        </Field>
        <Field label={uiText("ui.currency")}>
          <Select
            value={value.currency}
            disabled={dataSource === "api"}
            onChange={(e) =>
              onChange({ ...value, currency: e.target.value as Currency })
            }
            options={dataSource === "api" ? [value.currency] : [...CURRENCIES]}
          />
        </Field>
      </div>

      <Field label={uiText("ui.capacity")} hint={uiText("ui.1.for.1.1.higher.for.group.sessions.or.workshops")}>
        <Input
          type="number"
          value={String(value.capacity)}
          onChange={(e) =>
            onChange({
              ...value,
              capacity: Math.max(1, Number(e.target.value) || 1),
            })
          }
          min={1}
        />
      </Field>

      <Field
        label={uiText("ui.booking.confirmation")}
        hint={uiText("ui.choose.whether.bookings.confirm.automatically.or.wait.for.your.approval")}
      >
        <Select
          value={value.confirmationPolicy}
          onChange={(e) =>
            onChange({
              ...value,
              confirmationPolicy: e.target.value as Service["confirmationPolicy"],
            })
          }
          options={[
            { value: "automatic", label: uiText("ui.confirm.automatically") },
            { value: "operator_approval", label: uiText("ui.review.before.confirming") },
          ]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={uiText("ui.location.type")}>
          <Select
            value={value.locationType}
            onChange={(e) =>
              onChange({
                ...value,
                locationType: e.target.value as LocationType,
              })
            }
            options={[
              { value: "online", label: uiText("ui.online") },
              { value: "physical", label: uiText("ui.in.person") },
              { value: "hybrid", label: uiText("ui.hybrid") },
            ]}
          />
        </Field>
        <Field label={uiText("ui.meeting.location")}>
          <Input
            value={value.location}
            onChange={(e) => onChange({ ...value, location: e.target.value })}
          />
        </Field>
      </div>

      {value.locationType !== "physical" && (
        <Field
          label={uiText("ui.meeting.link")}
          optional
          hint={uiText("ui.zoom.google.meet.or.teams.clients.get.it.once.their.booking.is.confirmed")}
          error={
            value.meetingUrl && !/^https:\/\/\S+$/.test(value.meetingUrl.trim())
              ? uiText("ui.use.a.full.https.link")
              : undefined
          }
        >
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={value.meetingUrl ?? ""}
            onChange={(e) => onChange({ ...value, meetingUrl: e.target.value })}
          />
        </Field>
      )}

      {value.locationType !== "online" && (
        <AddressPicker
          value={value.address}
          onChange={(address) => onChange({ ...value, address })}
          savedLocations={savedLocations}
          title={uiText("ui.default.address")}
          description={uiText("ui.new.sessions.of.this.service.will.inherit.this.address.you.can.override.per.session")}
        />
      )}

      <Field label={uiText("ui.cancellation.reschedule.rule")}>
        <Textarea
          value={value.cancellationRule}
          rows={2}
          onChange={(e) =>
            onChange({ ...value, cancellationRule: e.target.value })
          }
        />
      </Field>

      <Field
        label={uiText("ui.internal.notes")}
        optional
        hint={uiText("ui.only.visible.to.you.use.for.prep.instructions.materials.or.context")}
      >
        <Textarea
          value={value.notes ?? ""}
          rows={3}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder={uiText("ui.e.g.bring.projector.whiteboard.markers.send.pre.reads.48h.ahead")}
        />
      </Field>

      {dataSource === "mock" && (
        <AttachedFormsField serviceId={serviceId} disabled={disabled} />
      )}

      {showActiveToggle && (
        <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
          <div>
            <div className="text-[14px] font-medium text-ink">
              {value.active ? uiText("ui.active") : uiText("ui.inactive")}
            </div>
            <div className="text-small">
              {uiText("ui.inactive.services.don.t.appear.on.the.booking.page")}</div>
          </div>
          <Toggle
            checked={value.active}
            onChange={(v) => onChange({ ...value, active: v })}
          />
        </div>
      )}
    </fieldset>
  );
}
