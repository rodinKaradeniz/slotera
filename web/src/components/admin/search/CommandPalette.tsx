"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useSearch, type SearchResult } from "@/lib/search";
import { SearchResultsList, flattenGroups } from "./SearchResultsList";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    document.body.classList.add("scroll-locked");
    return () => {
      window.clearTimeout(t);
      document.body.classList.remove("scroll-locked");
    };
  }, [open]);

  const { loading, groups } = useSearch(query, 6);
  const flat = React.useMemo(() => flattenGroups(groups), [groups]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const navigate = (r: SearchResult) => {
    onClose();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flat.length === 0) return;
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length === 0) return;
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      if (flat[activeIndex]) {
        e.preventDefault();
        navigate(flat[activeIndex]);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[640px] bg-surface border border-line rounded-lg shadow-3 flex flex-col max-h-[60vh] overflow-hidden"
        style={{ marginTop: "-4vh" }}
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-line-soft">
          <Icon name="search" size={16} className="text-ink-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search bookings, clients, services, sessions…"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3 text-ink"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-ink-3 hover:text-ink"
            aria-label="Close"
          >
            <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-line-soft">
              esc
            </kbd>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SearchResultsList
            groups={groups}
            query={query}
            loading={loading}
            activeIndex={activeIndex}
            onSelect={navigate}
            onHover={setActiveIndex}
            variant="palette"
          />
        </div>
        <div className="border-t border-line-soft px-5 py-2.5 flex items-center justify-between text-micro">
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="font-mono">↑</kbd>
              <kbd className="font-mono">↓</kbd> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="font-mono">↵</kbd> open
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="font-mono">esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
