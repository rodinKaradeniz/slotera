import * as React from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Decorative, hand-arranged collage of miniature Slotera UI fragments.
 * Hidden on mobile; positioned absolutely on lg+ so it never compresses
 * the hero text column.
 */
export function HeroCollage() {
  return (
    <div
      className="pointer-events-none hidden lg:block absolute -top-8 -bottom-10 right-0 w-[420px] xl:w-[500px] 2xl:w-[560px] select-none"
      aria-hidden
    >
      <div className="relative w-full h-full">
        {/* Soft radial glow behind the cards */}
        <div
          className="absolute -inset-10 rounded-full blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, rgba(61,90,61,0.10), transparent 70%)",
          }}
        />

        {/* Next session — upper-left of collage (still right of hero text) */}
        <CardFrame className="absolute top-[35%] left-[12%] w-[230px]" z={2}>
          <NextSessionMini />
        </CardFrame>

        {/* Revenue — upper-right corner */}
        <CardFrame className="absolute top-[7.5%] left-[40%] w-[210px]" z={3}>
          <RevenueMini />
        </CardFrame>

        {/* Calendar — mid-left, just below next session */}
        <CardFrame className="absolute top-[65%] left-[-5%] w-[210px]" z={1}>
          <CalendarMini />
        </CardFrame>

        {/* Receipt — mid-right, just below revenue */}
        <CardFrame className="absolute top-[36%] right-0 w-[195px]" z={3} glass>
          <ReceiptMini />
        </CardFrame>

        {/* Booking row — lower-center, anchored right */}
        <CardFrame
          className="absolute bottom-[-15%] right-[15%] w-[235px]"
          z={3}
        >
          <BookingRowMini />
        </CardFrame>
      </div>
    </div>
  );
}

function CardFrame({
  children,
  className,
  z = 1,
  glass = false,
}: {
  children: React.ReactNode;
  className?: string;
  z?: number;
  glass?: boolean;
}) {
  const style: React.CSSProperties = {
    zIndex: z,
    boxShadow:
      "0 1px 0 rgba(31,31,26,0.04), 0 12px 28px -10px rgba(31,31,26,0.16), 0 30px 60px -30px rgba(31,31,26,0.18)",
  };
  return (
    <div
      className={[
        "rounded-lg border border-line overflow-hidden",
        glass ? "bg-surface/85 backdrop-blur-[6px]" : "bg-surface",
        className ?? "",
      ].join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────── */
/* Mini UI fragments                              */
/* ────────────────────────────────────────────── */

function NextSessionMini() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-md bg-accent-soft text-accent flex items-center justify-center">
          <Icon name="calendar-days" size={14} />
        </span>
        <span className="eyebrow">Next session</span>
      </div>
      <div
        className="font-serif text-ink mt-2.5 leading-tight"
        style={{ fontSize: 16, fontWeight: 400 }}
      >
        Strategy Call · Mara K.
      </div>
      <div className="text-[11.5px] text-ink-3 mt-1">Today · 14:30–15:00</div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-[10.5px] font-mono uppercase tracking-wider text-accent">
          Confirmed
        </span>
        <span className="w-1 h-1 rounded-full bg-ink-4" />
        <span className="text-[10.5px] text-ink-3">Zoom</span>
      </div>
    </div>
  );
}

function RevenueMini() {
  const bars = [38, 52, 44, 60, 48, 72, 84];
  const max = 84;
  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Revenue · 7d</span>
        <span className="text-[10.5px] font-mono text-accent">+12%</span>
      </div>
      <div
        className="font-serif text-ink mt-1.5"
        style={{ fontSize: 22, fontWeight: 380, lineHeight: 1 }}
      >
        £2,840
      </div>
      <div className="mt-3 flex items-end gap-1 h-12">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${(h / max) * 100}%`,
              background:
                i === bars.length - 1 ? "var(--accent)" : "var(--accent-soft)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CalendarMini() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const cells = Array.from({ length: 28 }, (_, i) => i + 1);
  const accents = new Set([4, 11, 18, 22]);
  const today = 18;
  return (
    <div className="p-3">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[11px] font-medium text-ink">May 2026</span>
        <div className="flex gap-1 text-ink-4">
          <Icon name="chevron-l" size={11} />
          <Icon name="chevron-r" size={11} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 px-1">
        {days.map((d, i) => (
          <div
            key={`d-${i}`}
            className="text-center text-[9px] font-mono text-ink-4"
          >
            {d}
          </div>
        ))}
        {cells.map((n) => {
          const isToday = n === today;
          const hasDot = accents.has(n);
          return (
            <div
              key={n}
              className="aspect-square flex flex-col items-center justify-center"
            >
              <span
                className={[
                  "text-[10px]",
                  isToday
                    ? "bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center"
                    : "text-ink-2",
                ].join(" ")}
              >
                {n}
              </span>
              {hasDot && !isToday && (
                <span className="w-1 h-1 rounded-full bg-accent mt-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingRowMini() {
  const rows = [
    { name: "Léa Mertens", time: "10:00", svc: "Deep dive" },
    { name: "Jamal Reid", time: "11:30", svc: "Discovery" },
    { name: "Sora Park", time: "15:00", svc: "Strategy" },
  ];
  return (
    <div className="py-2.5">
      <div className="px-4 pb-2 flex items-center justify-between border-b border-line-soft">
        <span className="eyebrow">Today · 3 bookings</span>
        <Icon name="filter" size={11} className="text-ink-4" />
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="px-4 py-2 flex items-center gap-2.5 border-b border-line-soft last:border-b-0"
        >
          <span className="w-6 h-6 rounded-full bg-accent-soft text-accent-ink flex items-center justify-center text-[9px] font-medium">
            {r.name
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-ink truncate">{r.name}</div>
            <div className="text-[10px] text-ink-3 truncate">{r.svc}</div>
          </div>
          <span className="text-[10.5px] font-mono text-ink-2">{r.time}</span>
        </div>
      ))}
    </div>
  );
}

function ReceiptMini() {
  return (
    <div className="p-3.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Receipt</span>
        <span className="text-[10px] font-mono text-ink-3">SLT-7K2P</span>
      </div>
      <div className="mt-2 text-[11px] text-ink">Strategy Call · 30 min</div>
      <div
        className="h-px my-2.5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, var(--line-soft) 0 4px, transparent 4px 8px)",
        }}
      />
      <RowMini label="Subtotal" value="£140" />
      <RowMini label="VAT 20%" value="£28" />
      <div
        className="h-px my-2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, var(--line-soft) 0 4px, transparent 4px 8px)",
        }}
      />
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-ink-3">
          Total
        </span>
        <span
          className="font-serif text-ink"
          style={{ fontSize: 16, fontWeight: 400 }}
        >
          £168
        </span>
      </div>
    </div>
  );
}

function RowMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[10.5px]">
      <span className="text-ink-3">{label}</span>
      <span className="text-ink-2">{value}</span>
    </div>
  );
}
