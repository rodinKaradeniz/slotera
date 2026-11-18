"use client";
import * as React from "react";
export function ProgressiveText({
  text,
  animate = false,
}: {
  text: string;
  animate?: boolean;
}) {
  const words = React.useMemo(() => text.split(/(\s+)/), [text]);
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    if (
      !animate ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const step = Math.max(2, Math.ceil(words.length / 100));
    const timer = window.setInterval(
      () =>
        setShown((n) => {
          if (n + step >= words.length) window.clearInterval(timer);
          return Math.min(words.length, n + step);
        }),
      24,
    );
    return () => window.clearInterval(timer);
  }, [animate, words]);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <p
      aria-busy={!!animate && !reduced && shown < words.length}
      className="whitespace-pre-wrap break-words text-body"
    >
      {animate && !reduced ? words.slice(0, shown).join("") : text}
    </p>
  );
}
