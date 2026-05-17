import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function DemoStrip() {
  return (
    <section className="my-6">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="rounded-lg p-10 sm:p-16 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 bg-ink text-paper shadow-3">
          <div className="max-w-2xl">
            <div
              className="font-mono text-[11px] uppercase mb-3 opacity-70"
              style={{ letterSpacing: "0.14em" }}
            >
              See it in action
            </div>
            <h2
              className="font-serif"
              style={{
                fontSize: "clamp(28px, 3vw, 40px)",
                fontWeight: 380,
                lineHeight: 1.1,
                letterSpacing: "-0.015em",
              }}
            >
              Try a real booking flow. No sign-up needed.
            </h2>
          </div>
          <Link href="/booking">
            <Button variant="primary" size="lg" iconRight="arrow-right">
              Open live demo
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
