/**
 * English is the canonical message set. Every key here should have a matching
 * (best-effort, demo-grade) entry in `tr.ts` and `de.ts`. Missing keys fall
 * back to English at runtime, so partial translations are safe.
 *
 * This is a deliberately small first pass: high-visibility nav, CTAs, booking
 * flow, auth, and common action labels — not every seeded string.
 */
export const en = {
  // Common actions / labels
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.continue": "Continue",
  "common.close": "Close",
  "common.edit": "Edit",
  "common.search": "Search",
  "common.loading": "Loading…",
  "common.new": "New",
  "common.active": "Active",
  "common.inactive": "Inactive",

  // Admin nav (keyed by nav item id)
  "nav.dashboard": "Dashboard",
  "nav.calendar": "Calendar",
  "nav.bookings": "Bookings",
  "nav.clients": "Clients",
  "nav.services": "Services",
  "nav.forms": "Forms",
  "nav.settings": "Settings",
  "nav.overview": "Overview",
  "nav.workspaces": "Workspaces",
  "nav.subscriptions": "Subscriptions",
  "nav.inquiries": "Inquiries",

  // Public landing nav + CTAs
  "landing.nav.features": "Features",
  "landing.nav.pricing": "Pricing",
  "landing.nav.liveDemo": "Live demo",
  "landing.nav.contact": "Contact",
  "landing.cta.login": "Log in",
  "landing.cta.startTrial": "Start free trial",

  // Booking flow — step labels
  "booking.step.service": "Service",
  "booking.step.time": "Time",
  "booking.step.details": "Details",
  "booking.step.forms": "Forms",
  "booking.step.billing": "Billing",
  "booking.step.review": "Review",
  "booking.step.pay": "Pay",
  // Booking flow — buttons
  "booking.back": "Back",
  "booking.continue": "Continue",
  "booking.payConfirm": "Pay and confirm",
  "booking.reservePay": "Reserve and pay",
  "booking.confirm": "Confirm booking",

  // Auth
  "auth.login.submit": "Sign in",
  "auth.register.submit": "Create account",
  "auth.field.email": "Email",
  "auth.field.password": "Password",

  // Contact modal
  "contact.title": "Get in touch",
  "contact.send": "Send message",
  "contact.field.name": "Name",
  "contact.field.email": "Email",
  "contact.field.message": "Message",

  // Forms feature
  "forms.title": "Forms",
  "forms.new": "New form",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
