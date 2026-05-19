"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { Logo } from "@/components/ui/Logo";
import { currentSession } from "@/services/auth.service";
import { listServices } from "@/services/services.service";
import { listSessions } from "@/services/sessions.service";
import { getSettings } from "@/services/settings.service";
import { cn } from "@/lib/cn";

type SetupKey = "service" | "availability" | "payments";

type SetupStep = {
  key: SetupKey;
  title: string;
  body: string;
  icon: IconName;
  cta: string;
  href: string;
};

const SETUP_STEPS: SetupStep[] = [
  {
    key: "service",
    title: "Create your first service",
    body: "Define what you offer — duration, capacity, price. You can edit it later.",
    icon: "layers",
    cta: "Create service",
    href: "/admin/services",
  },
  {
    key: "availability",
    title: "Set your availability",
    body: "Tell Slotera which days and hours clients can book.",
    icon: "calendar",
    cta: "Set hours",
    href: "/admin/settings",
  },
  {
    key: "payments",
    title: "Set up payments",
    body: "Connect a processor or add manual payment instructions (bank transfer, Interac, etc.) for your booking page.",
    icon: "card",
    cta: "Set up payments",
    href: "/admin/settings",
  },
];

type Completion = Record<SetupKey, boolean>;

const EMPTY: Completion = {
  service: false,
  availability: false,
  payments: false,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = React.useState<Completion>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [operatorName, setOperatorName] = React.useState<string>("Operator");

  React.useEffect(() => {
    const session = currentSession();
    const first = session?.operator.firstNames?.trim().split(/\s+/)[0];
    if (first) setOperatorName(first);
    else if (session?.operator.name) setOperatorName(session.operator.name);

    let cancelled = false;
    (async () => {
      const [services, sessions, settings] = await Promise.all([
        listServices(),
        listSessions(),
        getSettings(),
      ]);
      if (cancelled) return;
      const hasService = services.length > 0;
      const hasAvailability =
        settings.calendar.workingHours.some((d) => d.enabled) ||
        sessions.length > 0;
      const hasPayments =
        settings.payments.processors.some((p) => p.status === "connected") ||
        (settings.payments.manualPaymentEnabled &&
          settings.payments.manualPaymentInstructions.trim().length > 0);
      setState({
        service: hasService,
        availability: hasAvailability,
        payments: hasPayments,
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const total = SETUP_STEPS.length;
  const done = SETUP_STEPS.filter((s) => state[s.key]).length;
  const percent = Math.round((done / total) * 100);
  const allDone = done === total;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <Logo />
        <button
          type="button"
          onClick={() => router.push("/admin/dashboard")}
          className="text-small text-ink-3 hover:text-ink"
        >
          Skip for now
        </button>
      </div>

      <Card padded>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
          <div className="flex flex-col">
            <div className="eyebrow mb-3">Welcome, {operatorName}</div>
            <h1 className="text-h2 text-ink">
              Let&apos;s get your workspace ready.
            </h1>
            <p className="text-body mt-3 text-ink-3">
              Complete three setup steps, then open your booking page when
              you&apos;re ready to share it.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <div className="flex-1 h-1.5 bg-paper-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-small font-mono text-ink-2">
                {done} / {total}
              </span>
            </div>

            <div className="mt-6 rounded-md border border-line-soft bg-paper-2 p-4 text-small text-ink-3">
              <div className="eyebrow mb-1.5">How completion works</div>
              Each step is marked done automatically once the underlying setting
              exists in your workspace — a service, working hours, or a payment
              method. No checklists to babysit.
            </div>

            <div className="mt-auto pt-8 hidden lg:block">
              <Link href="/admin/dashboard">
                <Button
                  variant="primary"
                  size="md"
                  iconRight="arrow-right"
                >
                  Go to dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {SETUP_STEPS.map((s, i) => {
              const isDone = state[s.key];
              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-md border transition-colors",
                    isDone
                      ? "bg-accent-soft border-[rgba(61,90,61,0.25)]"
                      : "bg-surface border-line",
                  )}
                >
                  <span
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      isDone
                        ? "bg-accent text-white"
                        : "bg-paper-2 text-ink-2",
                    )}
                  >
                    {isDone ? (
                      <Icon name="check" size={16} strokeWidth={2.5} />
                    ) : (
                      <span className="font-mono text-[11px]">0{i + 1}</span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon name={s.icon} size={13} className="text-ink-3" />
                      <h3
                        className="font-serif text-ink"
                        style={{ fontSize: 16, fontWeight: 400 }}
                      >
                        {s.title}
                      </h3>
                      {isDone && <Pill tone="accent">Done</Pill>}
                    </div>
                    <p className="text-small mt-1 text-ink-3">{s.body}</p>
                  </div>
                  <div className="flex flex-shrink-0">
                    <Link href={s.href}>
                      <Button
                        variant={isDone ? "secondary" : "primary"}
                        size="sm"
                        iconRight="arrow-right"
                      >
                        {isDone ? "Review" : s.cta}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}

            <div
              className={cn(
                "mt-1 flex items-start gap-3 p-4 rounded-lg border-2 border-dashed transition-colors",
                allDone
                  ? "border-accent bg-accent-soft/40"
                  : "border-line-soft bg-paper-2/50",
              )}
            >
              <span
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  allDone
                    ? "bg-accent text-white"
                    : "bg-surface text-ink-3 border border-line",
                )}
              >
                <Icon name="link" size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className="font-serif text-ink"
                    style={{ fontSize: 16, fontWeight: 400 }}
                  >
                    Open your booking page
                  </h3>
                  <Pill tone={allDone ? "accent" : "neutral"}>
                    {allDone ? "Ready to share" : "Launch"}
                  </Pill>
                </div>
                <p className="text-small mt-1 text-ink-3">
                  {allDone
                    ? "Everything's wired up. Share the public link with clients or embed it on your site."
                    : "Finish the setup steps above, then preview and share your public booking page."}
                </p>
              </div>
              <div className="flex flex-shrink-0">
                <Link href="/booking" target="_blank" rel="noreferrer">
                  <Button
                    variant={allDone ? "primary" : "secondary"}
                    size="sm"
                    iconRight="arrow-right"
                  >
                    Open page
                  </Button>
                </Link>
              </div>
            </div>

            {loading && (
              <div className="text-micro text-ink-3 mt-1">
                Checking your workspace…
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-8 lg:hidden">
          <Link href="/admin/dashboard">
            <Button variant="primary" size="md" iconRight="arrow-right">
              Go to dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
