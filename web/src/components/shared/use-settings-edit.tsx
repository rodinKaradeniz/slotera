"use client";
import { useReviewedEdit } from "./use-reviewed-edit";

/** Settings sections share one revision, while each keeps its own unsaved draft. */
export function useSettingsEdit<T extends {version?: number}>(
  value: T | null, load: () => Promise<T>, replace: (value: T) => void,
) {
  return useReviewedEdit(!!value, value ? {...value, id: "settings"} : null,
    async () => ({...await load(), id: "settings"}), replace);
}
