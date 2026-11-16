"use client";
import {
  RecoverableError,
  toError,
} from "@/components/shared/RecoverableError";
import { ClientFooter } from "./ClientFooter";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BookingTheme } from "@/components/booking/BookingTheme";
import {
  requestClientSignIn,
  consumeClientSignIn,
} from "@/services/client-access.service";

export function ClientSignIn({ slug }: { slug: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [token, setToken] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  React.useEffect(() => {
    const capture = () => {
      const value = window.location.hash.slice(1);
      if (value) {
        window.history.replaceState(null, "", window.location.pathname);
        queueMicrotask(() => {
          setToken(value);
          setAccepted(false);
          setError(null);
        });
      }
    };
    capture();
    window.addEventListener("hashchange", capture);
    return () => window.removeEventListener("hashchange", capture);
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (token) {
        const identity = await consumeClientSignIn(token);
        setToken(null);
        router.replace(`/client/${encodeURIComponent(identity.slug)}`);
      } else {
        await requestClientSignIn(slug, email, lang);
        setAccepted(true);
      }
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <BookingTheme slug={slug}>
      <main className="max-w-md mx-auto px-5 py-12">
        <Card>
          <LanguageSwitcher />
          <h1 className="text-h2 mb-4">{t("client.signIn")}</h1>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {!token && (
              <Field label={t("ui.email")} required>
                <Input
                  type="email"
                  value={email}
                  required
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </Field>
            )}
            {accepted && <p role="status">{t("client.linkSent")}</p>}
            <RecoverableError error={error} messageKey="client.signInFailed" />
            <Button type="submit" loading={busy}>
              {t(token ? "client.signIn" : "client.sendLink")}
            </Button>
            {token && error && (
              <Button
                variant="ghost"
                onClick={() => {
                  setToken(null);
                  setError(null);
                }}
              >
                {t("client.newLink")}
              </Button>
            )}
          </form>
        </Card>
      </main>
      <ClientFooter />
    </BookingTheme>
  );
}
