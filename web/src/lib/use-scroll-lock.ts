"use client";
import { useEffect } from "react";

let locks = 0;
let previouslyLocked = false;

/** Nested confirmations must not unlock an underlying drawer. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (locks === 0) previouslyLocked = document.body.classList.contains("scroll-locked");
    locks += 1;
    document.body.classList.add("scroll-locked");
    return () => {
      locks -= 1;
      if (locks === 0 && !previouslyLocked) document.body.classList.remove("scroll-locked");
    };
  }, [active]);
}
