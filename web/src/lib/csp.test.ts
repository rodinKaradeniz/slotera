import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

describe("buildCsp", () => {
  it("allows the API origin to be called and nothing else cross-origin", () => {
    const csp = buildCsp("https://api.slotera.io/v1", "test-nonce");
    expect(csp).toContain("connect-src 'self' https://api.slotera.io;");
    expect(csp).not.toContain("*");
  });

  it("requires a nonce for scripts without permitting inline scripts or eval", () => {
    const csp = buildCsp("", "test-nonce");
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp.split("script-src ")[1].split(";")[0]).not.toContain("'unsafe-inline'");
  });

  it("blocks framing, plugins and foreign base URLs", () => {
    const csp = buildCsp("http://localhost:8000", "test-nonce");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("falls back to same-origin when the API URL is not a URL", () => {
    expect(buildCsp("not a url", "test-nonce")).toContain("connect-src 'self';");
  });
});
