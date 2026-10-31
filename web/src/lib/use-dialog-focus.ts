"use client";

import * as React from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside an open dialog: moves focus in when it opens (unless something
 * inside already has it), wraps Tab and Shift+Tab, and gives focus back to the opener on close.
 */
export function useDialogFocus(active: boolean, ref: React.RefObject<HTMLElement | null>): void {
  React.useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));

    if (!node.contains(document.activeElement)) (focusable()[0] ?? node).focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [active, ref]);
}
