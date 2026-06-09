import * as React from "react";
import { Icon } from "@/components/ui/Icon";

export type StepKey =
  | "service"
  | "time"
  | "details"
  | "forms"
  | "billing"
  | "review"
  | "pay";

export type Step = { key: StepKey; label: string };

// Canonical full sequence. The booking flow drops "forms" when the chosen
// service has no attached forms, and passes the resulting list via `steps`.
export const STEPS: Step[] = [
  { key: "service", label: "Service" },
  { key: "time",    label: "Time" },
  { key: "details", label: "Details" },
  { key: "forms",   label: "Forms" },
  { key: "billing", label: "Billing" },
  { key: "review",  label: "Review" },
  { key: "pay",     label: "Pay" },
];

const DOT = 14;

type Props = { current: StepKey; steps?: Step[] };

export function StepIndicator({ current, steps = STEPS }: Props) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="w-full">
      <div className="relative flex items-start justify-between" style={{ minHeight: 56 }}>
        <div
          className="absolute left-0 right-0 bg-line-soft rounded-full"
          style={{ top: DOT / 2 - 1, height: 2 }}
        />
        <div
          className="absolute left-0 bg-accent rounded-full transition-[width] duration-500"
          style={{
            top: DOT / 2 - 1,
            height: 2,
            width: idx > 0 ? `${(idx / (steps.length - 1)) * 100}%` : 0,
          }}
        />
        {steps.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div
              key={s.key}
              className="relative flex flex-col items-center text-center"
              style={{ width: 1 }}
            >
              <span
                className="rounded-full flex items-center justify-center relative z-10"
                style={{
                  width: DOT,
                  height: DOT,
                  background: done
                    ? "var(--accent)"
                    : active
                      ? "var(--accent)"
                      : "var(--surface)",
                  border: active
                    ? "0"
                    : done
                      ? "0"
                      : "1.5px solid var(--line)",
                  boxShadow: active
                    ? "0 0 0 5px rgba(61,90,61,0.14)"
                    : undefined,
                  color: "white",
                }}
              >
                {done && <Icon name="check" size={10} strokeWidth={3} />}
                {active && (
                  <span
                    className="rounded-full bg-white"
                    style={{ width: 5, height: 5 }}
                  />
                )}
              </span>
              <span
                className="mt-3 text-[11px] uppercase tracking-[0.04em] font-mono whitespace-nowrap"
                style={{
                  color:
                    i <= idx ? "var(--ink-2)" : "var(--ink-4)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
