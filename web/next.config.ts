import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
