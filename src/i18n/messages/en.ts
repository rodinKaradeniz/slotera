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

  // Demo guide modal
  "demoGuide.eyebrow": "Demo guide",
  "demoGuide.title": "Welcome to Slotera",
  "demoGuide.motto": "Paid bookings, without the calendar chaos.",
  "demoGuide.disclaimer":
    "This is a demo version of Slotera, built to showcase the main booking and admin workflows. Some features are mocked while the product is still in progress.",
  "demoGuide.youCanTry": "You can try:",
  "demoGuide.step.account.title": "Sign in or create a demo account",
  "demoGuide.step.account.body":
    "Use the authentication flow to provision a workspace and access the admin dashboard.",
  "demoGuide.step.account.cta": "Create demo account",
  "demoGuide.step.dashboard.title": "Explore the admin dashboard",
  "demoGuide.step.dashboard.body":
    "Create services, manage availability, view bookings, and test the main admin workflows.",
  "demoGuide.step.dashboard.cta": "Open admin dashboard",
  "demoGuide.step.booking.title": "Test the public booking page",
  "demoGuide.step.booking.body":
    "See exactly what customers see when they book a service end-to-end.",
  "demoGuide.step.booking.tryAs": "Try it as:",
  "demoGuide.step.booking.defaultLink": "Open the standard booking page",
  "demoGuide.persona.consultant": "Consultant",
  "demoGuide.persona.vet": "Vet",
  "demoGuide.persona.therapist": "Therapist",
  "demoGuide.persona.trainer": "Personal trainer",
  "demoGuide.noteLabel": "Note:",
  "demoGuide.note":
    "This is a demo environment, so some flows use mocked data while the product is still in progress. If anything looks off, you spot a bug or a broken flow, have a business inquiry or feature request, or would like to book time to discuss Slotera — feel free to reach out.",
  "demoGuide.contact": "Contact us",
  "demoGuide.close": "Close",
  "demoGuide.startExploring": "Start exploring",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
