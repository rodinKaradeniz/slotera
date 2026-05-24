"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";
import { cn } from "@/lib/cn";

/**
 * Toast primitive. Top-right stack, auto-dismiss after ~3.5s, click to dismiss
 * early. Animations gated on `prefers-reduced-motion`. Mount one `ToastProvider`
 * near the root of each route group (admin/public/auth) and use `useToast()`
 * from descendants.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Bookings live");
 *   toast.error("Couldn't save", { description: err.message });
 *   toast.info("Bookings paused", { description: "Existing bookings unaffected." });
 */

export type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
  description?: string;
  /** When true the item is animating out and waiting for unmount. */
  closing?: boolean;
};

type ToastOptions = {
  description?: string;
  /** Override the default 3500ms auto-dismiss. Pass 0 to disable. */
  durationMs?: number;
};

type ToastApi = {
  success: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
  info: (message: string, opts?: ToastOptions) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<{ toast: ToastApi } | null>(null);

export function useToast(): { toast: ToastApi } {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

const DEFAULT_DURATION_MS = 3500;
const EXIT_ANIMATION_MS = 200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  // Timeouts keyed by toast id so dismiss() can cancel them.
  const timeoutsRef = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeNow = React.useCallback((id: string) => {
    const t = timeoutsRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timeoutsRef.current.delete(id);
    }
    setItems((curr) => curr.filter((i) => i.id !== id));
  }, []);

  const dismiss = React.useCallback(
    (id: string) => {
      // Mark closing → wait for exit animation → remove. Skip the animation
      // wait if motion is reduced; the CSS already disables the keyframes.
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        removeNow(id);
        return;
      }
      setItems((curr) =>
        curr.map((i) => (i.id === id ? { ...i, closing: true } : i)),
      );
      window.setTimeout(() => removeNow(id), EXIT_ANIMATION_MS);
    },
    [removeNow],
  );

  const enqueue = React.useCallback(
    (kind: ToastKind, message: string, opts?: ToastOptions) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        id,
        kind,
        message,
        description: opts?.description,
      };
      setItems((curr) => [...curr, item]);
      const duration = opts?.durationMs ?? DEFAULT_DURATION_MS;
      if (duration > 0) {
        const handle = setTimeout(() => dismiss(id), duration);
        timeoutsRef.current.set(id, handle);
      }
    },
    [dismiss],
  );

  // Cancel pending timers on unmount so a remounted provider can't leak.
  React.useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      for (const handle of timeouts.values()) clearTimeout(handle);
      timeouts.clear();
    };
  }, []);

  const toast = React.useMemo<ToastApi>(
    () => ({
      success: (m, o) => enqueue("success", m, o),
      error: (m, o) => enqueue("error", m, o),
      info: (m, o) => enqueue("info", m, o),
      dismiss,
    }),
    [enqueue, dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const KIND_META: Record<
  ToastKind,
  { icon: IconName; iconClass: string; ring: string }
> = {
  success: {
    icon: "check",
    iconClass: "bg-accent-soft text-accent",
    ring: "ring-1 ring-[rgba(61,90,61,0.18)]",
  },
  error: {
    icon: "alert",
    iconClass: "bg-[#F6E2DE] text-danger",
    ring: "ring-1 ring-[rgba(163,59,42,0.18)]",
  },
  info: {
    icon: "info",
    iconClass: "bg-[#E2E8F0] text-info",
    ring: "ring-1 ring-[rgba(63,86,112,0.18)]",
  },
};

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (items.length === 0) return null;

  return createPortal(
    <div
      // `pointer-events-none` on the stack so it can't block clicks; each toast
      // re-enables them. `aria-live` polite so screen readers announce them.
      className="fixed top-4 right-4 z-60 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)] w-[360px]"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {items.map((item) => {
        const meta = KIND_META[item.kind];
        return (
          <div
            key={item.id}
            data-state={item.closing ? "closed" : "open"}
            className={cn(
              "toast-item pointer-events-auto bg-surface border border-line rounded-lg shadow-3 px-3.5 py-3 flex items-center gap-3",
              meta.ring,
            )}
            role={item.kind === "error" ? "alert" : "status"}
          >
            <span
              className={cn(
                "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
                meta.iconClass,
              )}
            >
              <Icon name={meta.icon} size={14} strokeWidth={2.25} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-ink leading-snug">
                {item.message}
              </div>
              {item.description && (
                <div className="text-small text-ink-3 mt-0.5 leading-snug">
                  {item.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="shrink-0 text-ink-3 hover:text-ink p-1 -m-1 rounded-md"
              aria-label="Dismiss notification"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
