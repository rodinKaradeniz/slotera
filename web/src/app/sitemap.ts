import type { MetadataRoute } from "next";
import { dataSource, siteUrl } from "@/lib/env";
import { sitemapFor } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor(dataSource, siteUrl);
}
