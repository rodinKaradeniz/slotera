"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  createCalendarFeed,
  getCalendarFeed,
  revokeCalendarFeed,
  type CalendarFeedStatus,
} from "@/services/settings.service";
import { fmtDate } from "@/lib/time";

/**
 * Settings → Calendar: a private link the operator's calendar app subscribes to. It
 * shows sessions with client names, so it is treated like a password: shown once,
 * revocable, and replaced when regenerated.
 */
export function CalendarFeedCard() {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [status, setStatus] = React.useState<CalendarFeedStatus | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"regenerate" | "revoke" | null>(null);

  React.useEffect(() => {
    getCalendarFeed().then(setStatus);
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      setUrl(await createCalendarFeed());
      setStatus(await getCalendarFeed());
      setConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : uiText("ui.could.not.create.the.link"));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await revokeCalendarFeed();
      setUrl(null);
      setStatus({ active: false, createdAt: null });
      setConfirm(null);
      toast.success(uiText("ui.calendar.link.turned.off"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success(uiText("ui.link.copied"));
  };

  return (
    <Card padded>
      <div className="mb-4">
        <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>
          {uiText("ui.subscribe.in.your.calendar.app")}</h2>
        <p className="text-small mt-1">
          {uiText("ui.see.your.slotera.sessions.in.google.calendar.apple.calendar.or.outlook.the.link.shows.clie")}</p>
      </div>

      {url ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="primary" icon="copy" onClick={copy}>
              {uiText("ui.copy")}</Button>
          </div>
          <p className="text-small text-warning">
            {uiText("ui.copy.it.now.for.your.privacy.it.won.t.be.shown.again")}</p>
          <ul className="text-small text-ink-2 list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong>{uiText("ui.google.calendar")}</strong> {uiText("ui.other.calendars.from.url.then.paste.google.refreshes.subscribed.calendars.every.few.hours")}</li>
            <li>
              <strong>{uiText("ui.apple.calendar")}</strong> {uiText("ui.file.new.calendar.subscription.then.paste")}</li>
            <li>
              <strong>{uiText("ui.outlook")}</strong> {uiText("ui.add.calendar.subscribe.from.web.then.paste")}</li>
          </ul>
        </div>
      ) : status?.active ? (
        <p className="text-small text-ink-2">
          {uiText("ui.a.link.is.active.created")}{" "}
          {status.createdAt ? fmtDate(new Date(status.createdAt)) : "earlier"}{uiText("ui.for.your.privacy.it.can.t.be.shown.again.create.a.new.one.if.you.need.it")}</p>
      ) : (
        <p className="text-small text-ink-2">{uiText("ui.no.link.yet")}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 mt-5 pt-4 border-t border-line-soft">
        {status?.active && (
          <Button variant="ghost" disabled={busy} onClick={() => setConfirm("revoke")}>
            {uiText("ui.turn.off")}</Button>
        )}
        <Button
          variant={status?.active ? "secondary" : "primary"}
          icon="calendar"
          disabled={busy || status === null}
          onClick={() => (status?.active ? setConfirm("regenerate") : create())}
        >
          {status?.active ? uiText("ui.create.a.new.link") : uiText("ui.create.calendar.link")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={confirm === "revoke" ? revoke : create}
        title={confirm === "revoke" ? uiText("ui.turn.off.the.calendar.link") : uiText("ui.create.a.new.link")}
        description={uiText("ui.calendars.subscribed.to.the.current.link.stop.updating.this.can.t.be.undone")}
        confirmLabel={confirm === "revoke" ? uiText("ui.turn.off") : uiText("ui.create.new.link")}
        destructive={confirm === "revoke"}
        busy={busy}
      />
    </Card>
  );
}
