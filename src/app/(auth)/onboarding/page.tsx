"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { Logo } from "@/components/ui/Logo";
import {
  getOnboarding,
  markOnboardingStep,
  currentSession,
} from "@/services/auth.service";
import type { OnboardingState } from "@/types/auth";
import { cn } from "@/lib/cn";

type Step = {
  key: keyof OnboardingState;
  title: string;
  body: string;
  icon: IconName;
  cta: string;
  href: string;
};

const STEPS: Step[] = [
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
    key: "share",
    title: "Open your booking page",
    body: "Share the public link with clients or embed it on your site.",
    icon: "link",
    cta: "View page",
    href: "/booking",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = React.useState<OnboardingState>({
    service: false,
    availability: false,
    share: false,
  });
  const [operatorName, setOperatorName] = React.useState<string>("Operator");

  React.useEffect(() => {
    setState(getOnboarding());
    const session = currentSession();
    if (session?.operator.name) setOperatorName(session.operator.name);
  }, []);

  const total = STEPS.length;
  const done = STEPS.filter((s) => state[s.key]).length;
  const percent = Math.round((done / total) * 100);

  const toggle = (k: keyof OnboardingState) => {
    const next = markOnboardingStep(k, !state[k]);
    setState(next);
  };

  return (
    <div className="w-full max-w-[840px] mx-auto">
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
        <div className="eyebrow mb-3">Welcome, {operatorName.split(" ")[0]}</div>
        <h1 className="text-h2 text-ink">Let&apos;s get your workspace ready.</h1>
        <p className="text-body mt-3 text-ink-3">
          Three quick steps and you&apos;ll be live. You can return to this checklist anytime.
        </p>

        <div className="flex items-center gap-3 mt-5">
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

        <div className="flex flex-col gap-3 mt-6">
          {STEPS.map((s, i) => {
            const isDone = state[s.key];
            return (
              <div
                key={s.key}
                className={cn(
                  "flex items-start gap-4 p-5 rounded-md border transition-colors",
                  isDone
                    ? "bg-accent-soft border-[rgba(61,90,61,0.25)]"
                    : "bg-surface border-line",
                )}
              >
                <span
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    isDone
                      ? "bg-accent text-white"
                      : "bg-paper-2 text-ink-2",
                  )}
                >
                  {isDone ? (
                    <Icon name="check" size={18} strokeWidth={2.5} />
                  ) : (
                    <span className="font-mono text-[12px]">0{i + 1}</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon name={s.icon} size={14} className="text-ink-3" />
                    <h3
                      className="font-serif text-ink"
                      style={{ fontSize: 18, fontWeight: 400 }}
                    >
                      {s.title}
                    </h3>
                    {isDone && <Pill tone="accent">Done</Pill>}
                  </div>
                  <p className="text-body mt-1 text-ink-3">{s.body}</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link href={s.href}>
                    <Button
                      variant={isDone ? "secondary" : "primary"}
                      size="sm"
                      iconRight="arrow-right"
                    >
                      {s.cta}
                    </Button>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(s.key)}
                    className="text-[12px] text-ink-3 hover:text-ink"
                  >
                    {isDone ? "Mark undone" : "Mark done"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
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
