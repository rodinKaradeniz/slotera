/**
 * Owner of the `slotera.seen` sessionStorage key: which screens have already played their
 * first entrance this session, so someone using the app all day isn't made to watch the
 * same choreography twice. Storage failures fall back to "not seen" (the entrance plays).
 */
const KEY = "slotera.seen";

function read(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

/** One key per kind of screen: `/admin/bookings/abc` and `/admin/bookings/xyz` are one screen. */
export function screenKey(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return "/" + parts.map((part, i) => (i >= 2 ? ":id" : part)).join("/");
}

export function hasSeenScreen(screen: string): boolean {
  return read().has(screen);
}

export function markScreenSeen(screen: string): void {
  const seen = read();
  if (seen.has(screen)) return;
  seen.add(screen);
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    // Private mode or blocked storage: the entrance simply plays again next time.
  }
}
