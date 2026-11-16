import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("maintenance proxy", () => {
  it("enforces fresh production nonces even during maintenance", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAINTENANCE_MODE", "1");
    const request = new NextRequest("http://localhost/book/lena", {
      headers: {"Content-Security-Policy": "script-src *", "x-nonce": "attacker"},
    });
    const first = proxy(request);
    const second = proxy(request);
    expect(first.headers.get("Content-Security-Policy")).toContain("'nonce-");
    expect(first.headers.get("Content-Security-Policy")).not.toContain("attacker");
    expect(first.headers.get("Content-Security-Policy")).not.toEqual(second.headers.get("Content-Security-Policy"));
    expect(first.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
    expect(first.headers.get("x-middleware-request-content-security-policy")).toEqual(first.headers.get("Content-Security-Policy"));
  });

  it("passes requests through normally", () => {
    vi.stubEnv("MAINTENANCE_MODE", "");
    const response = proxy(new NextRequest("http://localhost/admin/dashboard"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("serves the maintenance page as a 503 while switched on", () => {
    vi.stubEnv("MAINTENANCE_MODE", "1");
    const response = proxy(new NextRequest("http://localhost/book/lena"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("600");
    expect(response.headers.get("x-middleware-rewrite")).toContain("/maintenance");
  });
});
