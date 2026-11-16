import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Always replace incoming nonce/CSP headers: callers cannot select their nonce.
  requestHeaders.delete("x-nonce");
  requestHeaders.delete("content-security-policy");
  const csp = process.env.NODE_ENV === "production"
    ? buildCsp(process.env.NEXT_PUBLIC_API_BASE_URL ?? "", btoa(crypto.randomUUID()))
    : undefined;
  if (csp) requestHeaders.set("Content-Security-Policy", csp);
  const maintenance = process.env.MAINTENANCE_MODE === "1"
    && request.nextUrl.pathname !== "/maintenance";
  const response = maintenance
    ? NextResponse.rewrite(new URL("/maintenance", request.url), {
        status: 503, headers: { "Retry-After": "600" }, request: { headers: requestHeaders },
      })
    : NextResponse.next({ request: { headers: requestHeaders } });
  if (csp) response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|monitoring|.*\\.[a-z0-9]+$).*)"],
};
