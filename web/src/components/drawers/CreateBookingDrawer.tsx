"use client";
import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { ClientIdentityFields } from "@/components/shared/forms/ClientIdentityFields";
import { validateClientIdentity, type ClientIdentity } from "@/lib/client-validation";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { localeForLang, type Lang } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import { createOperatorBooking } from "@/services/bookings.service";
import { getClient, searchClients } from "@/services/clients.service";
import { getSession, listBookableSessions } from "@/services/sessions.service";
import { serviceOptionsForIds, type ServiceOption } from "@/services/services.service";
import { getLanguagePreference } from "@/services/preferences.service";
import { dataSource } from "@/lib/env";
import { ApiRequestError } from "@/services/_errors";
import type { BookingDrawerProps } from "./BookingDrawer";
import type { Client } from "@/types/client";
import type { SessionItem } from "@/types/session";
import type { MessageKey } from "@/i18n/messages/en";

const emptyClient: ClientIdentity = { name: "", email: "", phone: "", company: "" };
export function CreateBookingDrawer({ open, onClose, defaultClientId, defaultSessionId, onSaved }: BookingDrawerProps) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const timezone = useWorkspaceTimezone();
  const root = React.useRef<HTMLDivElement>(null);
  const saving = React.useRef(false);
  const [clientMode, setClientMode] = React.useState("existing");
  const [identity, setIdentity] = React.useState<ClientIdentity>({ ...emptyClient });
  const [clientId, setClientId] = React.useState(defaultClientId ?? "");
  const [sessionId, setSessionId] = React.useState(defaultSessionId ?? "");
  const [search, setSearch] = React.useState("");
  const [clients, setClients] = React.useState<Client[]>([]);
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [services, setServices] = React.useState<ServiceOption[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [searching, setSearching] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);
  const [notes, setNotes] = React.useState("");
  const [reason, setReason] = React.useState(t("booking.create.reasonDefault"));
  const [sendEmail, setSendEmail] = React.useState(true);
  const [languageTouched, setLanguageTouched] = React.useState(false);
  const [language, setLanguage] = React.useState<Lang>(lang);
  const [key, setKey] = React.useState(() => crypto.randomUUID());
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<string, MessageKey>>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState(false);
  useResetOnOpen(open, [defaultClientId, defaultSessionId], () => {
    setClientMode("existing"); setIdentity({ ...emptyClient }); setClientId(defaultClientId ?? "");
    setSessionId(defaultSessionId ?? ""); setSearch(""); setNotes(""); setReason(t("booking.create.reasonDefault"));
    setSendEmail(true); setLanguage(lang); setLanguageTouched(false); setKey(crypto.randomUUID()); setErrors({}); setSubmitError(null); setDuplicate(false);
    setLoading(true); setSearching(true); setLoadError(null); setSearchError(null); setOffset(0); setSessions([]);
  });
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([listBookableSessions(offset), defaultSessionId ? getSession(defaultSessionId) : null]).then(async ([page, initial]) => {
      const catalog = await serviceOptionsForIds([...page.items.map((item) => item.serviceId), ...(initial ? [initial.serviceId] : [])]);
      if (!active) return;
      const eligible = initial && initial.status === "scheduled" && initial.bookedCount < initial.capacity && (page.items.some((s) => s.id === initial.id) || new Date(initial.startISO).getTime() > Date.now());
      setSessions((previous) => {
        const all = [...(offset ? previous : []), ...page.items, ...(eligible ? [initial] : [])];
        return [...new Map(all.map((s) => [s.id, s])).values()];
      });
      setServices((previous) => [...new Map([...previous, ...catalog].map((item) => [item.id, item])).values()]); setTotal(page.total); setLoading(false); setLoadError(null);
    }).catch((error: Error) => { if (active) { setLoadError(error.message); setLoading(false); } });
    return () => { active = false; };
  }, [open, defaultSessionId, offset, retry]);
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      Promise.all([searchClients(search, controller.signal), defaultClientId ? getClient(defaultClientId) : null]).then(([found, initial]) => {
        if (!active) return;
        setClients([...new Map([...found, ...(initial ? [initial] : [])].map((c) => [c.id, c])).values()]);
        setSearching(false); setSearchError(null);
      }).catch((error: Error) => { if (active) { setSearchError(error.message); setSearching(false); } });
    }, 200);
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [open, search, defaultClientId, retry]);
  React.useEffect(() => {
    if (!open || languageTouched || dataSource !== "api") return;
    let active = true;
    getLanguagePreference().then((value) => { if (active) setLanguage(value); })
      .catch(() => { if (active) setLanguage("en"); });
    return () => { active = false; };
  }, [open, languageTouched]);
  const save = async () => {
    if (saving.current) return;
    const invalid: Partial<Record<string, MessageKey>> = clientMode === "new" ? validateClientIdentity(identity) : {};
    if (clientMode === "existing" && !clients.some((client) => client.id === clientId)) invalid.clientId = "booking.create.clientRequired";
    if (!sessions.some((session) => session.id === sessionId)) invalid.sessionId = "booking.create.sessionRequired";
    if (!reason.trim()) invalid.reason = "booking.create.reasonRequired";
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => root.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus()); return;
    }
    setLanguageTouched(true);
    saving.current = true; setBusy(true); setSubmitError(null);
    try {
      const created = await createOperatorBooking({ sessionId, notes, auditReason: reason, sendEmail, language,
        ...(clientMode === "new" ? { newClient: { ...identity, name: identity.name.trim(), email: identity.email.trim().toLowerCase() } } : { clientId }),
      }, key);
      toast.success(t("ui.booking.created"));
      try { await onSaved?.(created); } catch { toast.info(t("booking.create.createdRefresh")); }
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("ui.couldn.t.save.booking"));
      setDuplicate(error instanceof ApiRequestError && error.code === "client_email_conflict");
    } finally { saving.current = false; setBusy(false); }
  };
  const selected = sessions.find((s) => s.id === sessionId);
  const service = services.find((s) => s.id === selected?.serviceId);
  return <DrawerShell open={open} onClose={() => !busy && onClose()} eyebrow={t("ui.new.booking")} title={t("ui.create.a.booking")}
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>{t("ui.close")}</Button><Button onClick={save} loading={busy} disabled={loading || !!loadError || (clientMode === "existing" && (searching || !!searchError))}>{t("ui.create.booking")}</Button></>}>
    <div ref={root}><fieldset disabled={busy} className="grid gap-5">
      <Field label={t("ui.client")}><Select value={clientMode} onChange={(e) => { setClientMode(e.target.value); setErrors({}); }} options={[
        { value: "existing", label: t("booking.create.existing") }, { value: "new", label: t("booking.create.new") }]} /></Field>
      {clientMode === "new" ? <ClientIdentityFields value={identity} errors={errors} onChange={(field, value) => setIdentity({ ...identity, [field]: value })} /> : <>
        <Field label={t("booking.create.search")}><Input maxLength={320} value={search} onChange={(e) => { setSearch(e.target.value); setClientId(""); setSearching(true); }} /></Field>
        {searchError ? <div role="alert">{searchError}<Button variant="ghost" onClick={() => setRetry((n) => n + 1)}>{t("forms.retry")}</Button></div> :
          <Field label={t("ui.client")} required error={errors.clientId && t(errors.clientId)}>
            <Select value={clientId} disabled={searching} aria-invalid={!!errors.clientId} onChange={(e) => setClientId(e.target.value)} options={[
              { value: "", label: searching ? t("ui.loading") : t("ui.select.a.client") }, ...clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.email}` }))]} />
            {!searching && !clients.length && <span>{t("booking.create.noClients")}</span>}
          </Field>}
      </>}
      {loadError ? <div role="alert">{loadError}<Button variant="ghost" onClick={() => { setLoading(true); setRetry((n) => n + 1); }}>{t("forms.retry")}</Button></div> :
        <Field label={t("ui.session")} required error={errors.sessionId && t(errors.sessionId)}>
          <Select value={sessionId} disabled={loading} aria-invalid={!!errors.sessionId} onChange={(e) => setSessionId(e.target.value)} options={[
            { value: "", label: loading ? t("ui.loading") : t("ui.select.a.session") }, ...sessions.map((s) => ({ value: s.id,
              label: `${services.find((v) => v.id === s.serviceId)?.name ?? t("ui.service")} · ${new Intl.DateTimeFormat(localeForLang(lang), { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(s.startISO))}` }))]} />
          {!loading && !sessions.length && <p>{t("booking.create.none")} <Link href="/admin/calendar" onClick={onClose} className="text-accent underline">{t("nav.calendar")}</Link></p>}
        </Field>}
      {offset + 50 < total && <Button variant="secondary" disabled={loading} onClick={() => { setLoading(true); setOffset((n) => n + 50); }}>{t("booking.create.more")}</Button>}
      {service && <p>{formatMoney(service.priceCents, service.currency, lang)}</p>}
      <p className="text-small text-ink-3">{t("booking.create.rules")}</p>
      <Field label={t("ui.reason")} required error={errors.reason && t(errors.reason)}><Input value={reason} maxLength={500} aria-invalid={!!errors.reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <Field label={t("ui.booking.note")} optional hint={t("ui.only.visible.to.you.context.for.this.specific.booking")}><Textarea value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} /></Field>
      <label className="flex items-center gap-3"><input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />{t("booking.create.send")}</label>
      <p className="text-small text-ink-3">{t("booking.create.sendHint")}</p>
      <Field label={t("booking.create.language")}><Select value={language} onChange={(e) => { setLanguageTouched(true); setLanguage(e.target.value as Lang); }} options={[{ value: "en", label: "English" }, { value: "tr", label: "Türkçe" }, { value: "de", label: "Deutsch" }]} /></Field>
      {submitError && <div role="alert" className="text-danger">{submitError}{duplicate && <Button variant="ghost" onClick={() => { setClientMode("existing"); setSearch(identity.email); setSearching(true); setClientId(""); }}>{t("booking.create.findExisting")}</Button>}</div>}
    </fieldset></div>
  </DrawerShell>;
}
