import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

describe("buildCsp", () => {
  it("allows the API origin to be called and nothing else cross-origin", () => {
    const csp = buildCsp("https://api.slotera.io/v1");
    expect(csp).toContain("connect-src 'self' https://api.slotera.io;");
    expect(csp).not.toContain("*");
  });

  it("blocks framing, plugins and foreign base URLs", () => {
    const csp = buildCsp("http://localhost:8000");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("falls back to same-origin when the API URL is not a URL", () => {
    expect(buildCsp("not a url")).toContain("connect-src 'self';");
  });
});
