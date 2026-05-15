import * as React from "react";

export function ConsultantIntro() {
  return (
    <div className="flex flex-col gap-5">
      <div className="eyebrow">EN · DE</div>
      <div className="flex items-start gap-4">
        <span
          className="rounded-full bg-accent-soft flex-shrink-0 flex items-center justify-center text-accent-ink font-serif"
          style={{ width: 88, height: 88, fontSize: 28 }}
          aria-label="Dr. Lena Hartmann"
        >
          LH
        </span>
        <div className="min-w-0">
          <h2
            className="font-serif text-ink"
            style={{
              fontSize: "clamp(26px, 3vw, 32px)",
              fontWeight: 380,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
            }}
          >
            Dr. Lena Hartmann
          </h2>
          <div className="text-small text-ink-3 mt-1">
            Strategy advisor · Berlin
          </div>
        </div>
      </div>
      <p className="text-body max-w-md">
        I work with founders on hard strategic decisions — pricing, positioning,
        and the messy choices between them. Most clients come to me before a
        fundraise, a pivot, or a launch.
      </p>
    </div>
  );
}
