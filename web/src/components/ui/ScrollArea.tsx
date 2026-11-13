"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/cn";

/** Native scrolling with a transparent overlay thumb that never consumes layout width. */
function Scrollbar({ targetRef, page = false, controls }: {
  targetRef?: React.RefObject<HTMLDivElement | null>;
  page?: boolean;
  controls: string;
}) {
  const { t } = useI18n();
  const [metrics, setMetrics] = React.useState({ height: 0, total: 0, top: 0, locked: false });
  const drag = React.useRef<{ y: number; top: number } | null>(null);
  const target = React.useCallback(() => page
    ? document.scrollingElement as HTMLElement | null
    : targetRef?.current ?? null, [page, targetRef]);

  React.useEffect(() => {
    const node = target();
    if (!node) return;
    const root = document.documentElement;
    const previousWidth = root.style.scrollbarWidth;
    const previousGutter = root.style.scrollbarGutter;
    if (page) {
      root.classList.add("overlay-scrollbars-ready");
      root.style.scrollbarWidth = "none";
      root.style.scrollbarGutter = "auto";
    }
    const measure = () => {
      const next = {
        height: page ? window.innerHeight : node.clientHeight,
        total: node.scrollHeight,
        top: node.scrollTop,
        locked: page && document.body.classList.contains("scroll-locked"),
      };
      setMetrics((old) => Object.keys(next).every((key) => old[key as keyof typeof old] === next[key as keyof typeof next]) ? old : next);
    };
    measure();
    const scrollSource = page ? window : node;
    scrollSource.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(node);
    resize?.observe(page ? document.body : node.firstElementChild ?? node);
    const changes = new MutationObserver(measure);
    changes.observe(page ? document.body : node, { childList: true, subtree: true });
    const locks = new MutationObserver(measure);
    if (page) locks.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      scrollSource.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      resize?.disconnect(); changes.disconnect(); locks.disconnect();
      if (page) {
        root.classList.remove("overlay-scrollbars-ready");
        root.style.scrollbarWidth = previousWidth;
        root.style.scrollbarGutter = previousGutter;
      }
    };
  }, [page, target]);

  const max = Math.max(0, metrics.total - metrics.height);
  const thumb = Math.min(metrics.height, Math.max(32, metrics.height ** 2 / Math.max(1, metrics.total)));
  const travel = metrics.height - thumb;
  const move = (top: number) => {
    const node = target();
    if (!node) return;
    node.scrollTo({ top: Math.max(0, Math.min(max, top)), behavior: "instant" });
  };
  if (max <= 1 || metrics.locked) return null;

  return <div
    role="scrollbar"
    tabIndex={0}
    aria-label={t(page ? "scroll.page" : "scroll.content")}
    aria-controls={controls}
    aria-orientation="vertical"
    aria-valuemin={0}
    aria-valuemax={Math.round(max)}
    aria-valuenow={Math.round(Math.max(0, Math.min(max, metrics.top)))}
    className={cn("overlay-scrollbar", page && "overlay-scrollbar-page")}
    // A stale development stylesheet must never put this control into document flow.
    style={{ position: page ? "fixed" : "absolute", top: 0, bottom: 0, right: 0,
      width: 12, zIndex: page ? 30 : 1, background: "transparent", touchAction: "none", userSelect: "none" }}
    onKeyDown={(event) => {
      const positions: Record<string, number> = {
        ArrowDown: metrics.top + 40, ArrowUp: metrics.top - 40,
        PageDown: metrics.top + metrics.height, PageUp: metrics.top - metrics.height,
        Home: 0, End: max,
      };
      if (!(event.key in positions)) return;
      event.preventDefault(); move(positions[event.key]);
    }}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus();
      const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
      const thumbTop = max ? metrics.top / max * travel : 0;
      const top = offset >= thumbTop && offset <= thumbTop + thumb
        ? metrics.top : (offset - thumb / 2) / Math.max(1, travel) * max;
      move(top);
      drag.current = { y: event.clientY, top: Math.max(0, Math.min(max, top)) };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (drag.current) move(drag.current.top + (event.clientY - drag.current.y) / Math.max(1, travel) * max);
    }}
    onPointerUp={() => { drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}
    onWheel={(event) => {
      if (page) return; // The native page wheel handler already scrolls this target.
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? metrics.height : 1;
      move(metrics.top + event.deltaY * scale);
    }}
  >
    <div className="overlay-scrollbar-thumb" style={{ height: thumb, width: 6, marginInline: 3, borderRadius: 999,
      background: "var(--ink-3)", transform: `translateY(${metrics.top / max * travel}px)` }} />
  </div>;
}

export function PageScrollbar() {
  return <Scrollbar page controls="page-content" />;
}

export function ScrollArea({ children, className, contentClassName }: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  return <div className={cn("relative flex flex-1 min-h-0 min-w-0", className)}>
    <div ref={ref} id={id} className="overlay-scroll-viewport flex-1 min-h-0 min-w-0 overflow-y-auto"
      style={{ scrollbarWidth: "none", scrollbarGutter: "auto" }}>
      <div className={contentClassName}>{children}</div>
    </div>
    <Scrollbar targetRef={ref} controls={id} />
  </div>;
}
