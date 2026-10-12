import { describe, expect, it } from "vitest";
import { robotsFor, sitemapFor } from "./seo";

describe("search engine rules", () => {
  it("indexes the marketing site but not the demo's signed-in areas", () => {
    const robots = robotsFor("mock", "https://www.slotera.io");
    expect(robots.rules).toMatchObject({
      allow: "/",
      disallow: ["/admin/", "/superadmin/", "/booking/"],
    });
    expect(robots.sitemap).toBe("https://www.slotera.io/sitemap.xml");
  });

  it("keeps the real app private except booking pages and the pilot form", () => {
    const robots = robotsFor("api", "");
    expect(robots.rules).toMatchObject({ allow: ["/book/", "/pilot"], disallow: "/" });
    expect(robots.sitemap).toBeUndefined();
  });

  it("lists absolute marketing URLs only when the site URL is known", () => {
    expect(sitemapFor("mock", "https://www.slotera.io").map((entry) => entry.url)).toEqual([
      "https://www.slotera.io",
      "https://www.slotera.io/terms",
      "https://www.slotera.io/privacy",
      "https://www.slotera.io/dpa",
    ]);
    expect(sitemapFor("mock", "")).toEqual([]);
    expect(sitemapFor("api", "https://app.slotera.io")).toEqual([]);
  });
});
