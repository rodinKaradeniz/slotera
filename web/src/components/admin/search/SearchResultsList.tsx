"use client";

import * as React from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SearchGroup, SearchResult } from "@/lib/search";

type Props = {
  groups: { group: SearchGroup; items: SearchResult[] }[];
  query: string;
  loading: boolean;
  activeIndex: number;
  onSelect: (r: SearchResult) => void;
  onHover: (index: number) => void;
  variant?: "dropdown" | "palette";
};

export function flattenGroups(
  groups: { group: SearchGroup; items: SearchResult[] }[],
): SearchResult[] {
  return groups.flatMap((g) => g.items);
}

export function SearchResultsList({
  groups,
  query,
  loading,
  activeIndex,
  onSelect,
  onHover,
  variant = "dropdown",
}: Props) {
  if (!query.trim()) {
    return (
      <div className="px-4 py-8 text-center text-small">
        Start typing to search bookings, clients, services, sessions, and pages.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-small">Searching…</div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-small">
        No results for <span className="text-ink">&ldquo;{query}&rdquo;</span>.
      </div>
    );
  }

  const offsets: number[] = [];
  groups.reduce((acc, g, i) => {
    offsets[i] = acc;
    return acc + g.items.length;
  }, 0);

  return (
    <div className={cn(variant === "palette" ? "py-2" : "py-1.5")}>
      {groups.map((g, groupIdx) => {
        const base = offsets[groupIdx];
        const items = g.items.map((item, localIdx) => ({
          item,
          index: base + localIdx,
        }));
        return (
          <div key={g.group} className="mb-1.5 last:mb-0">
            <div
              className={cn(
                "px-4 pt-2 pb-1 eyebrow",
                variant === "palette" && "px-5",
              )}
            >
              {g.group}
            </div>
            {items.map(({ item, index }) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => onHover(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(item);
                  }}
                  className={cn(
                    "w-full text-left flex items-start gap-3 transition-colors",
                    variant === "palette"
                      ? "px-5 py-2.5"
                      : "px-4 py-2",
                    isActive
                      ? "bg-accent-soft text-accent-ink"
                      : "hover:bg-paper-2 text-ink-2",
                  )}
                >
                  <span
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5",
                      isActive
                        ? "bg-accent text-white"
                        : "bg-paper-2 text-ink-3 border border-line-soft",
                    )}
                  >
                    <Icon name={item.icon} size={13} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={cn(
                        "block truncate",
                        variant === "palette"
                          ? "text-[14px] text-ink"
                          : "text-[13px] text-ink",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span className="block truncate text-[12px] text-ink-3">
                        {item.subtitle}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <Icon
                      name="arrow-right"
                      size={13}
                      className="mt-2 flex-shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
