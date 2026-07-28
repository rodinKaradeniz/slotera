import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/* Register the project's custom typography utilities (defined in globals.css)
 * as font-size classes so tailwind-merge doesn't dedupe `text-h1 text-ink`
 * down to just `text-ink`. Without this, every SectionHeader/PageHeader title
 * silently loses its heading class. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "h1", "h2", "h3", "body", "body-lg", "small", "micro"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
