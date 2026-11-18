"use client";

import * as React from "react";

const subscribe = (onChange: () => void) => {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverMinute = () => 0;

/** The current time, rounded to the minute and refreshed every 30 seconds (0 on the server). */
export function useMinute(): number {
  return React.useSyncExternalStore(subscribe, currentMinute, serverMinute);
}
