"use client";

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
      toast.error(error instanceof Error ? error.message : "Could not create the link");
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
      toast.success("Calendar link turned off");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Card padded>
      <div className="mb-4">
        <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>
          Subscribe in your calendar app
        </h2>
        <p className="text-small mt-1">
          See your Slotera sessions in Google Calendar, Apple Calendar or Outlook. The link
          shows client names, so keep it private like a password.
        </p>
      </div>

      {url ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="primary" icon="copy" onClick={copy}>
              Copy
            </Button>
          </div>
          <p className="text-small text-warning">
            Copy it now: for your privacy it won&apos;t be shown again.
          </p>
          <ul className="text-small text-ink-2 list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong>Google Calendar:</strong> Other calendars → + → From URL, then paste.
              Google refreshes subscribed calendars every few hours.
            </li>
            <li>
              <strong>Apple Calendar:</strong> File → New Calendar Subscription, then paste.
            </li>
            <li>
              <strong>Outlook:</strong> Add calendar → Subscribe from web, then paste.
            </li>
          </ul>
        </div>
      ) : status?.active ? (
        <p className="text-small text-ink-2">
          A link is active (created{" "}
          {status.createdAt ? fmtDate(new Date(status.createdAt)) : "earlier"}). For your
          privacy it can&apos;t be shown again; create a new one if you need it.
        </p>
      ) : (
        <p className="text-small text-ink-2">No link yet.</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 mt-5 pt-4 border-t border-line-soft">
        {status?.active && (
          <Button variant="ghost" disabled={busy} onClick={() => setConfirm("revoke")}>
            Turn off
          </Button>
        )}
        <Button
          variant={status?.active ? "secondary" : "primary"}
          icon="calendar"
          disabled={busy || status === null}
          onClick={() => (status?.active ? setConfirm("regenerate") : create())}
        >
          {status?.active ? "Create a new link" : "Create calendar link"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={confirm === "revoke" ? revoke : create}
        title={confirm === "revoke" ? "Turn off the calendar link?" : "Create a new link?"}
        description="Calendars subscribed to the current link stop updating. This can't be undone."
        confirmLabel={confirm === "revoke" ? "Turn off" : "Create new link"}
        destructive={confirm === "revoke"}
        busy={busy}
      />
    </Card>
  );
}
