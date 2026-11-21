"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import {BriefingCard} from "@/components/assistant/BriefingCard";
import { ConversationThread } from "@/components/messages/ConversationThread";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CardHead } from "@/components/shared/CardHead";
import { DetailLine } from "@/components/shared/DetailLine";
import { Stat } from "@/components/shared/Stat";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ClientNotes } from "@/components/admin/clients/ClientNotes";
import { ClientPrivacyActions } from "@/components/admin/clients/ClientPrivacyActions";
import { ClientPackagesCard } from "@/components/admin/clients/ClientPackagesCard";
import { plural } from "@/lib/text";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { getClient } from "@/services/clients.service";
import { listBookingSummaries, listBookingsByClient } from "@/services/bookings.service";
import { listSessions } from "@/services/sessions.service";
import { listServices } from "@/services/services.service";
import { formatMoney } from "@/lib/money";
import { useLoad } from "@/lib/use-load";
import { LoadError } from "@/components/shared/LoadError";
import { useWorkspaceCurrency } from "@/lib/use-workspace-currency";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import { clockIn } from "@/lib/calendar";
import { fmtDate } from "@/lib/time";
import { dataSource } from "@/lib/env";

type Tab = "overview" | "notes" | "messages";

const NONE: never[] = [];

export default function ClientDetailPage() {
  const { t: uiText } = useI18n();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { openBookingDrawer, openClientDrawer } = useDrawers();
  const id = params?.id;
  const loadDetail = React.useCallback(async () => {
    if (!id) return null;
    if (dataSource === "api") {
      const [client, page] = await Promise.all([getClient(id), listBookingSummaries({clientId: id})]);
      return {client, summaries: page.items, bookings: [], sessions: [], services: []};
    }
    const [client, bookings, sessions, services] = await Promise.all([
      getClient(id),
      listBookingsByClient(id),
      listSessions(),
      listServices(),
    ]);
    return { client, bookings, sessions, services, summaries: null };
  }, [id]);
  const { data, error, reload } = useLoad(loadDetail);
  const client = data?.client ?? null;
  const bookings = data?.summaries ?? data?.bookings ?? NONE;
  const sessions = data?.sessions ?? NONE;
  const services = data?.services ?? NONE;
  const [tab, setTab] = React.useState<Tab>("overview");
  const currency = useWorkspaceCurrency();
  const timezone = useWorkspaceTimezone();

  useSetCrumbs([
    { label: uiText("ui.clients"), href: "/admin/clients" },
    { label: client?.name ?? "Detail" },
  ]);

  return (
    <PageContainer>
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !client ? (
        <LoadingRows count={3} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => router.push("/admin/clients")}
            className="text-small text-ink-3 hover:text-ink mb-4 inline-flex items-center gap-1"
          >
            {uiText("ui.all.clients")}</button>

          <PageHeader
            eyebrow={uiText("ui.client")}
            title={
              <span className="inline-flex items-center gap-4">
                <Avatar name={client.name} size={48} />
                {client.name}
              </span>
            }
            description={
              client.role
                ? `${client.role} · ${client.company ?? client.email}`
                : (client.company ?? client.email)
            }
            meta={
              <span className="inline-flex items-center gap-2 flex-wrap">
                <StatusBadge kind="client" status={client.tag} />
                <span aria-hidden>·</span>
                <span>{uiText("ui.since")}{" "}{fmtDate(new Date(client.joinedISO))}</span>
                <span aria-hidden>·</span>
                <span>{plural(client.totalBookings, "booking")}</span>
              </span>
            }
            actions={
              <>
                <Button
                  variant="secondary"
                  size="md"
                  icon="edit"
                  onClick={() =>
                    openClientDrawer({
                      initial: client,
                      onSaved: reload,
                    })
                  }
                >
                  {uiText("ui.edit.client")}</Button>
                {dataSource === "api" && (
                  <ClientPrivacyActions
                    client={client}
                    onErased={reload}
                  />
                )}
                <Button
                  variant="primary"
                  size="md"
                  icon="plus"
                  onClick={() =>
                    openBookingDrawer({
                      defaultClientId: client.id,
                      onSaved: reload,
                    })
                  }
                >
                  {uiText("ui.book.a.session")}</Button>
              </>
            }
          />

          <div className="mb-6 mt-1">
            <Tabs
              value={tab}
              onChange={(v) => setTab(v as Tab)}
              tabs={[
                { value: "overview", label: uiText("ui.overview") },
                { value: "notes", label: uiText("ui.notes") },
                { value: "messages", label: uiText("client.messages") },
              ]}
            />
          </div>

          <TabPanel value={tab} order={["overview", "notes", "messages"]}>
          {tab === "messages" ? <Card>{client.erasedAt ? <p>{uiText("booking.emails.erased")}</p> : <ConversationThread key={id} clientId={id} />}</Card> : tab === "overview" ? (
            <div className="space-y-4">
              <Card padded={false}>
                <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-line-soft">
                  <PadStat label={uiText("ui.total.bookings")} value={String(client.totalBookings)} />
                  <PadStat label={uiText("ui.completed")} value={String(client.completedBookings)} />
                  <PadStat label={uiText("ui.cancelled")} value={String(client.cancelledBookings)} />
                  <PadStat label={uiText("ui.total.spent")} value={formatMoney(client.totalSpentCents, currency)} />
                  <PadStat
                    label={uiText("ui.avg.per.session")}
                    value={
                      client.completedBookings > 0
                        ? formatMoney(
                            Math.round(client.totalSpentCents / client.completedBookings),
                            currency,
                          )
                        : "—"
                    }
                  />
                </div>
              </Card>

              {!client.erasedAt && <BriefingCard clientId={client.id} />}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 items-stretch">
                <Card padded={false} className="min-w-0 flex flex-col lg:min-h-[22rem]">
                  <CardHead
                    title={uiText("ui.recent.bookings")}
                    right={
                      bookings.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/admin/bookings?client=${client.id}`)
                          }
                        >
                          {uiText("ui.view.all.bookings")}</Button>
                      ) : undefined
                    }
                  />
                  {bookings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-10">
                      <p className="text-small text-ink-2">{uiText("ui.no.recent.bookings.yet")}</p>
                      <p className="text-micro text-ink-3 mt-1">
                        {uiText("ui.new.bookings.will.appear.here.once.scheduled")}</p>
                    </div>
                  ) : (
                    <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
                      {bookings.map((b) => {
                        const session = sessions.find((s) => s.id === b.sessionId);
                        const service = services.find((s) => s.id === session?.serviceId);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => router.push(`/admin/bookings/${b.id}`)}
                            className="w-full grid grid-cols-[2fr_2fr_1fr_auto] items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm text-left"
                          >
                            <div className="text-[14px] text-ink truncate">
                              {("serviceName" in b ? b.serviceName : service?.name) ?? uiText("ui.service")}
                            </div>
                            <div className="text-small whitespace-nowrap">
                              {"startAt" in b ? `${fmtDate(new Date(b.startAt), "short")} · ${clockIn(b.startAt, timezone)}` : session
                                ? `${fmtDate(new Date(session.startISO), "short")} · ${clockIn(session.startISO, timezone)}` : "—"}
                            </div>
                            <div className="text-[14px] font-medium text-ink whitespace-nowrap">
                              {("startAt" in b ? b.coveredByPackage : b.paymentMethod === "package")
                                ? uiText("booking.package.marker")
                                : b.amountCents === 0 ? uiText("ui.free") : formatMoney(b.amountCents, b.currency)}
                            </div>
                            <StatusBadge kind="booking" status={b.status} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card padded={false} className="min-w-0 flex flex-col lg:min-h-[22rem]">
                  <CardHead title={uiText("ui.contact.info")} />
                  <div className="px-4 py-2">
                    <DetailLine icon="mail" label={uiText("ui.email")} value={client.email} />
                    {client.phone && (
                      <DetailLine icon="phone" label={uiText("ui.phone")} value={client.phone} />
                    )}
                    {client.company && (
                      <DetailLine
                        icon="building"
                        label={uiText("ui.company")}
                        value={client.company}
                      />
                    )}
                    {client.timezone && (
                      <DetailLine
                        icon="globe"
                        label={uiText("ui.timezone")}
                        value={client.timezone}
                      />
                    )}
                    {client.address && (
                      <DetailLine icon="map-pin" label={uiText("ui.address")} value={client.address} />
                    )}
                    {client.vatId && (
                      <DetailLine icon="file" label={uiText("ui.vat.id")} value={client.vatId} />
                    )}
                  </div>
                </Card>
              </div>

              <ClientPackagesCard clientId={client.id} readOnly={!!client.erasedAt} />
            </div>
          ) : (
            <ClientNotes clientId={client.id} />
          )}
          </TabPanel>
        </>
      )}
    </PageContainer>
  );
}

function PadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5">
      <Stat label={label} value={value} />
    </div>
  );
}
