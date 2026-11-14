"use client";
import * as React from "react";
import { searchServiceOptions } from "@/services/services.service";
import { useLoad } from "@/lib/use-load";
export function useServiceOptions(selectedIds: string[]) {
  const [search, setSearch] = React.useState("");
  const selectedKey = JSON.stringify([...new Set(selectedIds)].sort());
  const load = React.useCallback((signal?: AbortSignal) => searchServiceOptions(search, signal, JSON.parse(selectedKey) as string[], true), [search, selectedKey]);
  return {...useLoad(load), search, setSearch};
}
