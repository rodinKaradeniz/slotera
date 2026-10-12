import type { MetadataRoute } from "next";
import type { DataSource } from "./env";

/**
 * What search engines may index. The demo (mock, www.) is the marketing site: index it,
 * except the signed-in demo areas. The real app (api, app.) is private except operators'
 * booking pages and the pilot form; the API host sends `X-Robots-Tag: noindex` from Caddy.
 */
export function robotsFor(mode: DataSource, siteUrl: string): MetadataRoute.Robots {
  if (mode === "api") {
    return { rules: { userAgent: "*", allow: ["/book/", "/pilot"], disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/superadmin/", "/booking/"],
    },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}

/** The marketing site's public pages; the real app publishes no sitemap. */
export function sitemapFor(mode: DataSource, siteUrl: string): MetadataRoute.Sitemap {
  if (mode === "api" || !siteUrl) return [];
  return ["", "/terms", "/privacy", "/dpa"].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.3,
  }));
}
