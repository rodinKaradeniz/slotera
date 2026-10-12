import { describe, expect, it } from "vitest";
import { scrubEvent, scrubSpan, stripUrl } from "./sentry";

describe("Sentry scrubbing", () => {
  it("drops tokens in fragments and query strings", () => {
    expect(stripUrl("https://app.slotera.io/booking/manage#secret")).toBe(
      "https://app.slotera.io/booking/manage",
    );
    expect(stripUrl("https://app.slotera.io/reset-password?token=secret")).toBe(
      "https://app.slotera.io/reset-password",
    );
    expect(stripUrl("GET https://api.slotera.io/search?q=Maya")).toBe(
      "GET https://api.slotera.io/search",
    );
  });

  it("scrubs the request, cookies and breadcrumb URLs of an event", () => {
    const event = scrubEvent({
      type: undefined,
      request: { url: "https://x/booking/manage#t", query_string: "q=Maya", cookies: { a: "b" } },
      breadcrumbs: [{ category: "navigation", data: { from: "/a?q=1", to: "/b#t" } }],
    });
    expect(event.request).toEqual({ url: "https://x/booking/manage" });
    expect(event.breadcrumbs?.[0].data).toEqual({ from: "/a", to: "/b" });
  });

  it("scrubs span descriptions and URL attributes", () => {
    const span = scrubSpan({
      span_id: "1",
      trace_id: "2",
      start_timestamp: 0,
      description: "GET https://api/search?q=Maya",
      data: {
        "http.query": "?q=Maya",
        url: "https://api/search?q=Maya",
        "url.full": "https://app/booking/manage?_rsc=1#token",
        "http.method": "GET",
      },
    });
    expect(span.description).toBe("GET https://api/search");
    expect(span.data).toEqual({
      "http.query": "",
      url: "https://api/search",
      "url.full": "https://app/booking/manage",
      "http.method": "GET",
    });
  });
});
