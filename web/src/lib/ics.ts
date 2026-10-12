// The browser's "Add to calendar": an .ics file (Apple Calendar, Outlook, most phones)
// and a Google Calendar link. Mirrors server/src/slotera_api/calendar_ics.py, so the
// file a client downloads and the one attached to their email share a UID and replace
// each other. The manage link is never included: calendar entries get shared.

export type CalendarEventInput = {
  reference: string;
  startISO: string;
  endISO: string;
  title: string;
  location?: string;
  description?: string;
  url?: string;
};

export function bookingUid(reference: string): string {
  return `${reference.toLowerCase()}@slotera.io`;
}

/** 2026-11-03T13:00:00.000Z → 20261103T130000Z */
export function icsTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on lines that start with one space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
      limit = 74;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(event: CalendarEventInput, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Slotera//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${bookingUid(event.reference)}`,
    `DTSTAMP:${icsTime(now.toISOString())}`,
    `DTSTART:${icsTime(event.startISO)}`,
    `DTEND:${icsTime(event.endISO)}`,
    // Seconds since 1970, like the server: a later file replaces an earlier one.
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    `SUMMARY:${escape(event.title)}`,
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escape(event.description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(event: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsTime(event.startISO)}/${icsTime(event.endISO)}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
