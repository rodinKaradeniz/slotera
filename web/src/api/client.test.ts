import { afterEach, describe, expect, it, vi } from "vitest";
import { apiListAll } from "./client";

function stubPages(total: number, pageSize: number) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL) => {
      urls.push(String(input));
      const offset = Number(input.searchParams.get("offset"));
      const count = Math.max(0, Math.min(pageSize, total - offset));
      const items = Array.from({ length: count }, (_, i) => offset + i);
      return new Response(JSON.stringify({ items, total }), { status: 200 });
    }),
  );
  return urls;
}

describe("apiListAll", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps fetching pages until it has every item", async () => {
    const urls = stubPages(450, 200);
    const items = await apiListAll<number>("/clients");
    expect(items).toHaveLength(450);
    expect(items[449]).toBe(449);
    expect(urls).toHaveLength(3);
    expect(urls[1]).toContain("limit=200&offset=200");
  });

  it("adds paging to a path that already has filters", async () => {
    const urls = stubPages(1, 200);
    await apiListAll<number>("/bookings?clientId=abc", 50);
    expect(urls[0]).toContain("/bookings?clientId=abc&limit=50&offset=0");
  });

  it("stops on an empty page even if total says there is more", async () => {
    stubPages(10, 0);
    expect(await apiListAll<number>("/services")).toEqual([]);
  });
});
