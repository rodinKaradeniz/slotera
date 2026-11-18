"use client";
import { subscribeClientLifecycle } from "@/lib/client-lifecycle";
import { StatusBadge } from "@/components/shared/StatusBadge";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ClientFooter } from "./ClientFooter";
import { BookingTheme } from "./BookingTheme";
import { ConversationThread } from "@/components/messages/ConversationThread";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { useLoad } from "@/lib/use-load";
import { localeForLang, type Lang } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import {
  getClientSession,
  logoutClient,
  updateClientPreferences,
  listClientBookings,
  clientManagementAccess,
  type ClientIdentity,
} from "@/services/client-access.service";

function BookingHistory() {
  const { t, lang } = useI18n();
  const [offset, setOffset] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(
    (signal?: AbortSignal) => listClientBookings(offset, signal),
    [offset],
  );
  const result = useLoad(load);
  async function open(id: string) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const { url } = await clientManagementAccess(id);
      window.location.assign(url);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }
  return (
    <section className="flex flex-col gap-3">
      {(result.error || failed) && (
        <p role="alert">
          {t("client.failed")}{" "}
          <Button onClick={result.reload}>{t("ui.refresh")}</Button>
        </p>
      )}
      {!result.data && !result.error && (
        <p role="status">{t("messages.loading")}</p>
      )}
      {result.data?.items.map((booking) => (
        <article key={booking.id} className="border-b border-line pb-4">
          <h2 className="text-h3">{booking.serviceName}</h2>
          <p>
            {new Intl.DateTimeFormat(localeForLang(lang), {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(booking.startAt))}
          </p>
          <p>
            {booking.reference} ·{" "}
            <StatusBadge kind="booking" status={booking.status} /> ·{" "}
            {formatMoney(
              booking.amountCents,
              booking.currency as "GBP" | "EUR" | "USD",
            )}
          </p>
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => open(booking.id)}
          >
            {t("client.openBooking")}
          </Button>
        </article>
      ))}
      {result.data?.total === 0 && <p>{t("client.noBookings")}</p>}
      <div className="flex justify-between">
        <Button
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 25))}
        >
          {t("todo.previous")}
        </Button>
        <Button
          disabled={!result.data || offset + 25 >= result.data.total}
          onClick={() => setOffset(offset + 25)}
        >
          {t("todo.next")}
        </Button>
      </div>
    </section>
  );
}

function Preferences({
  identity,
  onSaved,
}: {
  identity: ClientIdentity;
  onSaved: (identity: ClientIdentity) => void;
}) {
  const { t, setLang } = useI18n();
  const [language, setLanguage] = React.useState<Lang>(identity.language);
  const [digest, setDigest] = React.useState(identity.messageDigestEnabled);
  const [followup, setFollowup] = React.useState(
    identity.automaticFollowupEnabled,
  );
  const [busy, setBusy] = React.useState(false);
  const [state, setState] = React.useState<"saved" | "failed" | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setState(null);
    try {
      const next = await updateClientPreferences({
        language,
        messageDigestEnabled: digest,
        automaticFollowupEnabled: followup,
      });
      onSaved(next);
      setLang(language);
      setState("saved");
    } catch {
      setState("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <p>{identity.email}</p>
      <Field label={t("client.language")}>
        <Select
          aria-label={t("client.language")}
          value={language}
          onChange={(event) => setLanguage(event.target.value as Lang)}
          options={[
            { value: "en", label: "English" },
            { value: "tr", label: "Türkçe" },
            { value: "de", label: "Deutsch" },
          ]}
        />
      </Field>
      <label>
        <input
          type="checkbox"
          checked={digest}
          onChange={(event) => setDigest(event.target.checked)}
        />{" "}
        {t("client.digest")}
      </label>
      <label>
        <input
          type="checkbox"
          checked={followup}
          onChange={(event) => setFollowup(event.target.checked)}
        />{" "}
        {t("client.followup")}
      </label>
      {state && (
        <p role={state === "failed" ? "alert" : "status"}>
          {t(`client.${state}`)}
        </p>
      )}
      <Button type="submit" loading={busy}>
        {t("client.save")}
      </Button>
    </form>
  );
}

const CLIENT_TABS = ["messages", "bookings", "account"] as const;

export function ClientWorkspace({ slug }: { slug: string }) {
  const { t, setLang } = useI18n();
  const router = useRouter();
  const initialized = React.useRef<string | null>(null);
  const [identity, setIdentity] = React.useState<ClientIdentity | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [tab, setTab] = React.useState<"messages" | "bookings" | "account">(
    "messages",
  );
  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      setIdentity(null);
      router.replace(`/client/${encodeURIComponent(slug)}/sign-in`);
    };
    const verify = () => {
      void getClientSession(controller.signal)
        .then((value) => {
          if (!active) return;
          if (value.slug !== slug) {
            expire();
            return;
          }
          if (initialized.current !== value.clientId) {
            initialized.current = value.clientId;
            setLang(value.language);
          }
          setIdentity(value);
          clearTimeout(timer);
          timer = setTimeout(
            expire,
            Math.max(0, Date.parse(value.expiresAt) - Date.now()),
          );
        })
        .catch((error) => {
          if (!active) return;
          if (
            error &&
            typeof error === "object" &&
            "status" in error &&
            error.status === 401
          )
            expire();
          else setFailed(true);
        });
    };
    const unsubscribe = subscribeClientLifecycle(expire);
    verify();
    window.addEventListener("slotera-client-auth-expired", expire);
    window.addEventListener("focus", verify);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("slotera-client-auth-expired", expire);
      unsubscribe();
      window.removeEventListener("focus", verify);
    };
  }, [slug, router, setLang]);
  if (!identity)
    return (
      <main className="max-w-xl mx-auto p-6">
        <p role={failed ? "alert" : "status"}>
          {t(failed ? "client.failed" : "messages.loading")}
        </p>
        {failed && (
          <Button onClick={() => window.location.reload()}>
            {t("ui.refresh")}
          </Button>
        )}
      </main>
    );
  return (
    <BookingTheme slug={slug}>
      <main className="max-w-4xl mx-auto p-5 md:py-10">
        <header className="flex flex-wrap justify-between gap-4 mb-6">
          <h1 className="text-h2">{identity.workspaceName}</h1>
          <Button
            variant="ghost"
            onClick={() => {
              void logoutClient().catch(() => setFailed(true));
            }}
          >
            {t("client.signOut")}
          </Button>
        </header>
        {failed && <p role="alert">{t("client.failed")}</p>}
        <Tabs
          className="mb-5"
          value={tab}
          onChange={(value) => setTab(value as typeof tab)}
          tabs={CLIENT_TABS.map((item) => ({ value: item, label: t(`client.${item}`) }))}
        />
        <Card>
          <TabPanel value={tab} order={CLIENT_TABS}>
          {tab === "messages" ? (
            <ConversationThread key={identity.clientId} />
          ) : tab === "bookings" ? (
            <BookingHistory key={identity.clientId} />
          ) : (
            <Preferences
              key={identity.clientId}
              identity={identity}
              onSaved={setIdentity}
            />
          )}
          </TabPanel>
        </Card>
      </main>
      <ClientFooter />
    </BookingTheme>
  );
}
