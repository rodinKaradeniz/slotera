"use client";
import { useSettingsEdit } from "@/components/shared/use-settings-edit";
import * as React from "react";
import { getBranding, saveBranding, DEFAULT_BRANDING, type Branding } from "@/services/branding.service";
import { brandingStyle } from "@/components/booking/BookingTheme";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
export function ApiBrandingPanel() {
 const { t } = useI18n();
 const [local, setLocal] = React.useState<Branding | null>(null);
 const [error, setError] = React.useState<string | null>(null);
 const [message, setMessage] = React.useState<string | null>(null);
 const [busy, setBusy] = React.useState(false);
 const [attempt, setAttempt] = React.useState(0);
 React.useEffect(() => { let active = true; getBranding().then((v) => { if (active) { setLocal(v); setError(null); } }).catch((e: Error) => { if (active) setError(e.message); }); return () => { active = false; }; }, [attempt]);
 const edit = useSettingsEdit(local, getBranding, setLocal);
 const save = async () => { if (!local || busy) return; setBusy(true); setError(null); setMessage(null); try { const next = await saveBranding(local); setLocal(next); edit.accept({...next, id: "settings"}); setMessage(t("branding.saved")); } catch(e) { edit.onError(e); setError(e instanceof Error ? e.message : t("forms.failed")); } finally { setBusy(false); } };
 return <Card padded>{edit.notice}{error && <p role="alert">{error}</p>}{!local ? <Button onClick={() => setAttempt(attempt + 1)}>{t("forms.retry")}</Button> : <div className="space-y-4"><h3 className="text-h3">{t("ui.branding")}</h3>
 <Field label={t("branding.accent")} hint={t("branding.contrast")}><Input value={local.accent} onChange={(e) => setLocal({ ...local, accent: e.target.value })}/></Field>
 <Field label={t("branding.font")}><Select value={local.fontFamily} onChange={(e) => setLocal({ ...local, fontFamily: e.target.value as "serif" | "sans" })} options={[{ value: "serif", label: "Fraunces" }, { value: "sans", label: "Inter Tight" }]}/></Field>
 <div className="booking-theme p-4 rounded-md border border-line" style={brandingStyle(local)}><h3 className="font-serif text-h3">{t("branding.preview")}</h3><Button className="mt-3">{t("branding.example")}</Button></div>
 <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => { setLocal({...DEFAULT_BRANDING, version: local.version}); setMessage(null); }}>{t("branding.reset")}</Button><Button loading={busy} onClick={save}>{t("branding.save")}</Button></div>
 {message && <p role="status">{message}</p>}
 </div>}</Card>;
}
