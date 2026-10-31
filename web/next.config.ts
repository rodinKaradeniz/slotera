import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { buildCsp } from "./src/lib/csp";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (web/Dockerfile).
  output: "standalone",
  // This repository has independent npm lockfiles outside `web/`. Keep
  // Turbopack's project boundary on the Next.js application explicitly.
  turbopack: {
    root: process.cwd(),
  },
  // Report-only: violations show in the browser console and block nothing yet (docs/TODO.md).
  // Production only, since the dev server needs eval.
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: buildCsp(apiBaseUrl) },
        ],
      },
    ];
  },
  // Root-of-section redirects done at the routing layer (not in a page.tsx),
  // because Next 16 + Turbopack tripped a Performance.measure race when a
  // server-side `redirect()` was the only thing a route's page.tsx did.
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: false,
      },
      {
        source: "/superadmin",
        destination: "/superadmin/overview",
        permanent: false,
      },
    ];
  },
};

// Source maps are uploaded (then deleted from the image) only when the build has a
// SENTRY_AUTH_TOKEN, i.e. the real app's Docker build. Local and demo builds skip it.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: process.env.SENTRY_RELEASE || undefined },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Browser reports go through this app's own origin so ad-blockers don't drop them.
  tunnelRoute: "/monitoring",
  silent: !process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
});
