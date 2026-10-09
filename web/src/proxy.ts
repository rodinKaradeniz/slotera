import { NextResponse, type NextRequest } from "next/server";

// Maintenance switch. Read at request time (server-only, not NEXT_PUBLIC_), so
// flipping MAINTENANCE_MODE=1 and restarting the container is enough — no rebuild.
export function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== "1") return NextResponse.next();
  return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export const config = {
  // Everything except Next internals, static files, and the maintenance page itself.
  matcher: ["/((?!_next/|favicon.ico|maintenance|.*\\.[a-z0-9]+$).*)"],
};
