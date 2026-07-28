"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useSearch, type SearchResult } from "@/lib/search";
import { SearchResultsList, flattenGroups } from "./SearchResultsList";

type Props = {
  onOpenPalette: () => void;
};

export function NavbarSearch({ onOpenPalette }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const { loading, groups } = useSearch(query, 4);
  const flat = React.useMemo(() => flattenGroups(groups), [groups]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!focused) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [focused]);

  const navigate = (r: SearchResult) => {
    setFocused(false);
    setQuery("");
    inputRef.current?.blur();
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
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const open = focused && query.trim().length > 0;

  return (
    <div
      ref={wrapRef}
      className="hidden md:block relative w-64"
    >
      <div
        className={cn(
          "flex items-center h-9 px-3 bg-surface border rounded-md gap-2",
          focused ? "border-ink-3" : "border-line",
        )}
      >
        <Icon name="search" size={14} className="text-ink-3" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder="Search…"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3 text-ink"
          aria-label="Search workspace"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-ink-3 hover:text-ink"
            aria-label="Clear search"
          >
            <Icon name="x" size={13} />
          </button>
        ) : (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onOpenPalette();
            }}
            className="text-[11px] font-mono text-ink-4 hover:text-ink-2 px-1.5 py-0.5 rounded border border-line-soft"
            aria-label="Open command palette"
            title="Open command palette"
          >
            ⌘K
          </button>
        )}
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 mt-2 bg-surface border border-line rounded-md shadow-3 max-h-[60vh] overflow-y-auto z-30"
          onMouseDown={(e) => e.preventDefault()}
        >
          <SearchResultsList
            groups={groups}
            query={query}
            loading={loading}
            activeIndex={activeIndex}
            onSelect={navigate}
            onHover={setActiveIndex}
            variant="dropdown"
          />
          <div className="border-t border-line-soft px-3 py-2 flex items-center justify-between text-micro">
            <span>↑↓ navigate · ↵ open · esc close</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onOpenPalette();
              }}
              className="text-ink-3 hover:text-ink inline-flex items-center gap-1"
            >
              Open palette <kbd className="font-mono">⌘K</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
