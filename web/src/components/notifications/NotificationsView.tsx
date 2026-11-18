"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadError } from "@/components/shared/LoadError";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DATA_CHANGED } from "@/api/query-cache";
import { listNotificationPage, markAllRead } from "@/services/notifications.service";
import type { Notification } from "@/types/notification";
import { NotificationRow } from "./NotificationRow";

const PAGE_SIZE = 20;

type Feed = { items: Notification[]; unread: number; next: string | null; done: boolean };

/**
 * Every notification, newest first. The next batch loads once the reader scrolls past the
 * middle of what is already loaded, so the list keeps ahead of them without a button.
 */
export function NotificationsView() {
  const { t, lang } = useI18n();
  const [feed, setFeed] = React.useState<Feed | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const loading = React.useRef(false);

  React.useEffect(() => {
    let live = true;
    listNotificationPage(null, PAGE_SIZE).then(
      (page) => {
        if (live) {
          setFeed({ items: page.items, unread: page.unreadCount, next: page.next, done: page.next === null });
          setError(null);
        }
      },
      (cause: unknown) => live && setError(cause instanceof Error ? cause.message : String(cause)),
    );
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener(DATA_CHANGED, refresh);
    return () => {
      live = false;
      window.removeEventListener(DATA_CHANGED, refresh);
    };
  }, [lang, attempt]);

  const loadMore = React.useCallback(async () => {
    if (!feed || feed.done || loading.current) return;
    loading.current = true;
    setLoadingMore(true);
    try {
      const page = await listNotificationPage(feed.next, PAGE_SIZE);
      setFeed((current) =>
        current && {
          items: [...current.items, ...page.items.filter((item) => !current.items.some((old) => old.id === item.id))],
          unread: page.unreadCount,
          next: page.next,
          done: page.next === null,
        },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      loading.current = false;
      setLoadingMore(false);
    }
  }, [feed]);

  // Watch the item halfway down the loaded list; when it scrolls into view, fetch more.
  const middle = feed ? Math.floor(feed.items.length / 2) : -1;
  const observer = React.useRef<IntersectionObserver | null>(null);
  const watchMiddle = React.useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      if (!node || typeof IntersectionObserver === "undefined") return;
      observer.current = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      });
      observer.current.observe(node);
    },
    [loadMore],
  );
  React.useEffect(() => () => observer.current?.disconnect(), []);

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      setFeed((current) => current && { ...current, unread: 0, items: current.items.map((item) => ({ ...item, unread: false })) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("ui.notifications.could.not.be.updated"));
    }
  };

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={t("ui.notifications")}
        description={t("notifications.retention")}
        meta={feed ? t("notifications.unread.count", { count: feed.unread }) : undefined}
        actions={
          feed && feed.unread > 0 ? (
            <Button variant="secondary" icon="check" onClick={handleMarkAll}>
              {t("ui.mark.all.read")}
            </Button>
          ) : undefined
        }
      />
      {error && !feed ? (
        <LoadError message={error} onRetry={() => setAttempt((value) => value + 1)} />
      ) : !feed ? (
        <LoadingRows count={6} />
      ) : feed.items.length === 0 ? (
        <EmptyState icon="bell" title={t("ui.no.notifications")} body={t("notifications.empty.body")} />
      ) : (
        <div>
          <Card padded={false} className="list-rise overflow-hidden">
            {feed.items.map((item, index) => (
              <div key={item.id} ref={index === middle ? watchMiddle : undefined}>
                <NotificationRow item={item} />
              </div>
            ))}
          </Card>
          <div className="py-6 text-center text-small" role="status">
            {loadingMore
              ? t("common.loading")
              : error
                ? <Button variant="ghost" onClick={() => void loadMore()}>{t("ui.try.again")}</Button>
                : feed.done
                  ? t("notifications.end")
                  : null}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
