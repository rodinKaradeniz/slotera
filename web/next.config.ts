import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (web/Dockerfile).
  output: "standalone",
  // This repository has independent npm lockfiles outside `web/`. Keep
  // Turbopack's project boundary on the Next.js application explicitly.
  turbopack: {
    root: process.cwd(),
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

export default nextConfig;
