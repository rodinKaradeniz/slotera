"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useDrawers } from "@/components/drawers/DrawersProvider";

type Props = { operatorName?: string };

export function Greeting({ operatorName = "Lena" }: Props) {
  const { openBookingDrawer } = useDrawers();
  const [copied, setCopied] = React.useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/booking`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const date = new Date();
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = operatorName.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between mb-10">
      <div>
        <div className="eyebrow mb-3">{dateStr}</div>
        <h1 className="text-h1 text-ink">Welcome back, {firstName}.</h1>
        <div className="mt-4">
          <Pill tone="success" icon="dot">Online · Berlin</Pill>
        </div>
      </div>
      <div
        className="flex flex-col gap-2 sm:items-end"
        style={{ minWidth: 220 }}
      >
        <Button
          variant="primary"
          size="md"
          icon="plus"
          className="w-full sm:w-[220px] whitespace-nowrap justify-start"
          onClick={() => openBookingDrawer()}
        >
          New booking
        </Button>
        <a href="/booking" target="_blank" rel="noreferrer" className="w-full sm:w-[220px]">
          <Button
            variant="secondary"
            size="md"
            icon="eye"
            full
            className="whitespace-nowrap justify-start"
          >
            View booking page
          </Button>
        </a>
        <Button
          variant="ghost"
          size="md"
          icon="copy"
          className="w-full sm:w-[220px] whitespace-nowrap justify-start"
          onClick={copyLink}
        >
          {copied ? "Copied" : "Copy booking link"}
        </Button>
      </div>
    </div>
  );
}
