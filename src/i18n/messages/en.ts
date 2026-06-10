/**
 * English is the canonical message set. Every key here should have a matching
 * (best-effort, demo-grade) entry in `tr.ts` and `de.ts`. Missing keys fall
 * back to English at runtime, so partial translations are safe.
 *
 * Covers high-visibility public surfaces: landing page, the public booking
 * flow, the demo reservation page, demo guide, and common action labels — not
 * every seeded string.
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
  "common.free": "Free",
  "common.optional": "Optional",

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
  "landing.nav.contact": "Contact",
  "landing.nav.demo": "Demo",
  "landing.cta.login": "Log in",
  "landing.cta.startTrial": "Start free trial",
  "landing.cta.openDemo": "Open demo",
  "landing.cta.tryDemo": "Try the demo",

  // Landing — hero
  "landing.hero.eyebrow": "For consultants, coaches & instructors",
  "landing.hero.title": "Paid bookings, without the calendar chaos.",
  "landing.hero.subtitle":
    "Slotera handles your reservation flow end-to-end — services, sessions, payments, calendars, reminders — so you stop running it from spreadsheets.",
  "landing.hero.badge.noCard": "No credit card required",
  "landing.hero.badge.cancel": "Cancel anytime",
  "landing.hero.badge.gdpr": "UK GDPR-aware",

  // Landing — logo wall
  "landing.logos.trustedBy":
    "Trusted by 1,200+ independent advisors, coaches and instructors across Europe.",

  // Landing — how it works
  "landing.how.eyebrow": "How it works",
  "landing.how.title":
    "Go from inbox tag-team to a real booking flow in an afternoon.",
  "landing.how.step1.title": "Define your sessions",
  "landing.how.step1.body":
    "Set up the services you offer with duration, capacity, and pricing. 1:1 or group — Slotera doesn't care.",
  "landing.how.step2.title": "Connect your calendar",
  "landing.how.step2.body":
    "Sync Google, Apple or Outlook. We respect your availability and prevent double-booking automatically.",
  "landing.how.step3.title": "Share one link",
  "landing.how.step3.body":
    "Clients pick a slot, pay, and get the meeting link. You see new bookings in your dashboard.",

  // Landing — features
  "landing.features.eyebrow": "Features",
  "landing.features.title":
    "Everything a solo operator needs. Nothing they don't.",
  "landing.features.calendar.title": "Smart calendar sync",
  "landing.features.calendar.body":
    "Two-way sync with Google, Apple, Outlook. Buffers and time zones handled.",
  "landing.features.payments.title": "Stripe-grade payments",
  "landing.features.payments.body":
    "Take cards or manual bank transfer. Issue invoices and refunds without leaving the app.",
  "landing.features.gdpr.title": "UK GDPR-aware",
  "landing.features.gdpr.body":
    "Built with UK data protection workflows in mind. Consent receipts, retention controls, DPA on request.",
  "landing.features.meeting.title": "Built-in meeting links",
  "landing.features.meeting.body":
    "Auto-generate Zoom or Meet links. Or use a physical address for in-person.",
  "landing.features.reminders.title": "Reminders that land",
  "landing.features.reminders.body":
    "Smart email + SMS reminders cut no-shows by 38% on average.",
  "landing.features.embed.title": "Embeddable & branded",
  "landing.features.embed.body":
    "Drop the booking page on your site or use the hosted URL. Your colors, your fonts.",

  // Landing — demo strip
  "landing.demoStrip.eyebrow": "See it in action",
  "landing.demoStrip.title": "Try a real booking flow. No sign-up needed.",

  // Landing — testimonials
  "landing.testimonials.eyebrow": "Testimonials",
  "landing.testimonials.title":
    "Operators we've quietly freed up an afternoon a week.",
  "landing.testimonials.q1":
    "I used to lose half a day every week to scheduling. Slotera collapsed that to a Sunday-night review.",
  "landing.testimonials.q2":
    "The booking page looks like part of my site. Clients don't even notice the handoff.",
  "landing.testimonials.q3":
    "Group workshops with capacity and waitlists used to need a CRM. Now it's two clicks.",

  // Landing — pricing
  "landing.pricing.eyebrow": "Pricing",
  "landing.pricing.title": "Straightforward pricing. Cancel anytime.",
  "landing.pricing.monthly": "Monthly",
  "landing.pricing.yearly": "Yearly · −20%",
  "landing.pricing.perMonth": "/mo",
  "landing.pricing.custom": "Custom",
  "landing.pricing.cta.startTrial": "Start free trial",
  "landing.pricing.cta.talk": "Talk to us",
  "landing.pricing.solo.name": "Solo",
  "landing.pricing.solo.blurb":
    "For independent operators getting paid bookings live.",
  "landing.pricing.solo.f1": "Unlimited services",
  "landing.pricing.solo.f2": "Stripe & manual bank-transfer payments",
  "landing.pricing.solo.f3": "Google / Apple calendar sync",
  "landing.pricing.solo.f4": "1 booking page",
  "landing.pricing.team.name": "Team",
  "landing.pricing.team.blurb": "For practices and studios with a small team.",
  "landing.pricing.team.f1": "Everything in Solo",
  "landing.pricing.team.f2": "Up to 10 team members",
  "landing.pricing.team.f3": "Group sessions & waitlists",
  "landing.pricing.team.f4": "Custom branding",
  "landing.pricing.customTier.name": "Custom",
  "landing.pricing.customTier.blurb":
    "For schools, networks and multi-location studios.",
  "landing.pricing.customTier.f1": "Everything in Team",
  "landing.pricing.customTier.f2": "Unlimited team members",
  "landing.pricing.customTier.f3": "SSO & audit log",
  "landing.pricing.customTier.f4": "Priority support & DPA",

  // Landing — FAQ
  "landing.faq.eyebrow": "FAQ",
  "landing.faq.title": "Common questions.",
  "landing.faq.q1.q": "Do my clients need an account?",
  "landing.faq.q1.a":
    "No. Clients book and pay as guests. You see them as clients in your dashboard automatically.",
  "landing.faq.q2.q": "What payment processors do you support?",
  "landing.faq.q2.a":
    "Stripe (cards) is the default. Manual bank-transfer instructions can be enabled workspace-wide.",
  "landing.faq.q3.q": "Can I run group classes or workshops?",
  "landing.faq.q3.a":
    "Yes. Set the session capacity to any number above 1. Slotera handles spots-left and waitlists.",
  "landing.faq.q4.q": "Where are you hosted?",
  "landing.faq.q4.a": "Slotera is built with UK data protection workflows in mind.",
  "landing.faq.q5.q": "Can I embed the booking page on my own site?",
  "landing.faq.q5.a":
    "Yes. You can either link to the hosted booking page or embed it as an iframe. Your colors and fonts come through either way.",
  "landing.faq.q6.q": "What happens if a client cancels?",
  "landing.faq.q6.a":
    "Cancellations follow the policy you set on each service. The session frees up automatically and refunds flow through the same processor you used to take payment.",

  // Landing — final CTA
  "landing.finalCta.eyebrow": "Try Slotera",
  "landing.finalCta.title": "Stop chasing slots.",
  "landing.finalCta.body":
    "Spin up your booking page in under 10 minutes. Free for 14 days, no credit card required.",

  // Footer
  "footer.tagline":
    "Slotera helps independent advisors and coaches run their reservation flow without juggling spreadsheets, calendars and invoices.",
  "footer.col.product": "Product",
  "footer.col.company": "Company",
  "footer.col.legal": "Legal",
  "footer.link.demo": "Demo",
  "footer.link.legal": "Legal",
  "footer.copyright": "© Velora Labs. Slotera is a product by Velora Labs.",
  "footer.gdpr": "UK GDPR-aware",

  // Public legal modal (landing)
  "legal.title": "Legal",
  "legal.description":
    "Imprint, privacy notice, and terms of service for the Slotera demo.",
  "legal.tab.imprint": "Imprint",
  "legal.tab.privacy": "Privacy",
  "legal.tab.terms": "Terms",
  "legal.imprint.intro":
    "Slotera is a product by Velora Labs. This is a demo environment — the imprint below is a placeholder while the product is in development.",
  "legal.imprint.company": "Company",
  "legal.imprint.contact": "Contact",
  "legal.imprint.responsible": "Responsible",

  // Contact modal
  "contact.eyebrow": "Contact",
  "contact.title": "Get in touch",
  "contact.description":
    "Business inquiries, development issues, feature requests — drop us a line and we'll get back to you.",
  "contact.send": "Send message",
  "contact.field.name": "Name",
  "contact.field.email": "Email",
  "contact.field.reason": "Reason",
  "contact.field.message": "Message",
  "contact.reason.business": "Business inquiry",
  "contact.reason.development": "Development issue",
  "contact.reason.feature": "Feature request",
  "contact.reason.general": "General request",
  "contact.message.placeholder": "Tell us what's on your mind…",
  "contact.success.title": "Message sent.",
  "contact.success.body":
    "Thanks for reaching out — a teammate will reply within one business day. (This is a mocked confirmation — nothing was actually sent.)",
  "contact.success.bodyPersist":
    "Thanks — Slotera will reach out within one business day.",

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

  // Booking — top bar / footer chrome
  "booking.topbar.with": "Booking with",
  "booking.topbar.secure": "SSL secured · UK GDPR-aware",
  "booking.footer.secure": "Secure checkout · Powered by Slotera",

  // Booking — intro fallback (used only when no persona/settings copy)
  "booking.intro.title": "Strategy advisor",

  // Booking — date & time step
  "booking.datetime.availableTimes": "Available times",
  "booking.datetime.pickDate": "Pick a date to see available times.",
  "booking.datetime.prevMonth": "Previous month",
  "booking.datetime.nextMonth": "Next month",

  // Booking — details step
  "booking.details.firstName": "First name",
  "booking.details.lastName": "Last name",
  "booking.details.email": "Email",
  "booking.details.phone": "Phone",
  "booking.details.company": "Company",
  "booking.details.notes": "Anything you'd like to share before the call?",
  "booking.details.consent": "I agree to the {terms}.",
  "booking.details.consentLink": "Terms and Privacy Policy",

  // Booking — legal modal
  "booking.legal.title": "Terms and Privacy Policy",
  "booking.legal.description":
    "Booking terms set by this provider, plus Slotera's platform terms and privacy notice.",
  "booking.legal.tab.provider": "Provider Booking Terms",
  "booking.legal.tab.platform": "Slotera Terms & Privacy",
  "booking.legal.defaultProviderTerms":
    "This provider hasn't set custom booking terms. Standard cancellation and refund expectations apply — please contact the provider directly with any questions.",
  "booking.legal.termsHeading": "Terms",
  "booking.legal.privacyHeading": "Privacy",

  // Booking — forms / field controls
  "booking.field.yes": "Yes",
  "booking.field.no": "No",
  "booking.field.select": "Select…",

  // Booking — billing step
  "booking.billing.line1": "Address line 1",
  "booking.billing.line1.placeholder": "Street and number",
  "booking.billing.line2": "Address line 2",
  "booking.billing.line2.placeholder": "Unit, suite, apartment, etc.",
  "booking.billing.city": "City",
  "booking.billing.region": "State / Region / Province",
  "booking.billing.country": "Country",
  "booking.billing.postal": "Postal code",

  // Booking — review step
  "booking.review.service": "Service",
  "booking.review.when": "When",
  "booking.review.details": "Your details",
  "booking.review.forms": "Forms",
  "booking.review.formsCompleted": "{count} forms completed",
  "booking.review.billing": "Billing",
  "booking.review.edit": "Edit",

  // Booking — receipt card
  "booking.receipt.paymentReceipt": "Payment receipt",
  "booking.receipt.orderSummary": "Order summary",
  "booking.receipt.almostDone": "Almost done",
  "booking.receipt.reviewBooking": "Review your booking",
  "booking.receipt.service": "Service",
  "booking.receipt.client": "Client",
  "booking.receipt.billingAddress": "Billing address",
  "booking.receipt.subtotal": "Subtotal",
  "booking.receipt.total": "Total",
  "booking.receipt.paymentMethod": "Payment method",
  "booking.receipt.manualInstructions": "Manual payment instructions",
  "booking.receipt.footerManual":
    "Manual payments require operator confirmation before your booking is final.",
  "booking.receipt.footerCard": "Encrypted · PCI-DSS via Stripe (mocked)",
  "booking.receipt.footerReview":
    "You won't be charged until you confirm in the next step.",

  // Booking — payment step
  "booking.payment.method": "Payment method",
  "booking.payment.card": "Card",
  "booking.payment.manual": "Manual payment",
  "booking.payment.cardholderName": "Cardholder name",
  "booking.payment.cardNumber": "Card number",
  "booking.payment.cardNumberHint":
    "Use 4242 4242 4242 4242 for a mock success, or 4000 0000 0000 0002 for a mock failure.",
  "booking.payment.expiration": "Expiration",
  "booking.payment.cvc": "CVC",
  "booking.payment.instructions": "Payment instructions",
  "booking.payment.instructionsFallback":
    "Payment instructions will be shared after you confirm.",
  "booking.payment.pendingNote":
    "Your booking will be marked pending until the operator confirms receipt of payment.",

  // Booking — confirmation page
  "booking.confirm.title": "Your booking is confirmed.",
  "booking.confirm.emailSent": "We've sent a confirmation email to {email}.",
  "booking.confirm.emailSentNoAddress": "We've sent a confirmation email.",
  "booking.confirm.reference": "Reference {ref}",
  "booking.confirm.service": "Service",
  "booking.confirm.when": "When",
  "booking.confirm.attendee": "Attendee",
  "booking.confirm.meetingLink": "Meeting link",
  "booking.confirm.copyLink": "Copy meeting link",
  "booking.confirm.copied": "Copied",
  "booking.confirm.bookAnother": "Book another session",
  "booking.confirm.manage": "Manage reservation",
  "booking.confirm.addCalendar.title": "Add to calendar",
  "booking.confirm.addCalendar.body": "Google · Apple · Outlook · ICS",
  "booking.confirm.invoice.title": "Download invoice",
  "booking.confirm.invoice.body": "PDF, billing-ready",
  "booking.confirm.forward.title": "Forward email",
  "booking.confirm.forward.body": "Loop in a colleague",

  // Booking — failure page
  "booking.failure.title": "Payment declined.",
  "booking.failure.body":
    "We couldn't process that card. You can try another card or pick a different payment method.",
  "booking.failure.backToPayment": "Back to payment",
  "booking.failure.cancel": "Cancel booking",

  // Booking — paused card
  "booking.paused.title": "Bookings are paused",
  "booking.paused.body":
    "This booking page isn't currently accepting new reservations. If you need to get in touch, send a message and we'll reply.",
  "booking.paused.cta": "Get in touch",

  // Demo reservation page (/reservation/demo)
  "reservation.badge": "Demo",
  "reservation.title": "Your reservation",
  "reservation.subtitle":
    "A preview of what your clients could see after booking — review details, complete optional forms, and stay in touch. This is a demo with mocked data.",
  "reservation.summary.title": "Reservation summary",
  "reservation.summary.service": "Service",
  "reservation.summary.provider": "Provider",
  "reservation.summary.when": "Date & time",
  "reservation.summary.status": "Status",
  "reservation.summary.location": "Location",
  "reservation.summary.payment": "Payment",
  "reservation.summary.reference": "Reference",
  "reservation.status.confirmed": "Confirmed",
  "reservation.status.pendingPayment": "Pending payment",
  "reservation.location.online": "Online — meeting link sent by email",
  "reservation.payment.manualLabel": "Manual payment",
  "reservation.payment.instructionsLabel": "Payment instructions",
  "reservation.actions.title": "What's next",
  "reservation.actions.formsLabel": "Complete optional forms",
  "reservation.actions.formsHint": "A couple of quick questions before your session.",
  "reservation.actions.messageLabel": "Send a message",
  "reservation.actions.messageHint": "Ask the provider anything about your booking.",
  "reservation.actions.rescheduleLabel": "Request reschedule",
  "reservation.actions.rescheduleHint": "Need another time? Ask for a new slot.",
  "reservation.actions.cancelLabel": "Request cancellation",
  "reservation.actions.cancelHint": "Let the provider know you can't make it.",
  "reservation.forms.title": "Optional forms",
  "reservation.forms.note":
    "These weren't required before payment. You can complete them now or any time before your session.",
  "reservation.forms.completedBadge": "Completed",
  "reservation.forms.optionalBadge": "Optional",
  "reservation.forms.save": "Save form",
  "reservation.forms.saved": "Form saved",
  "reservation.forms.savedDesc": "Thanks — your answers were saved (mocked).",
  "reservation.form.notes.name": "Additional notes before your session",
  "reservation.form.notes.desc": "Anything you'd like the provider to know in advance.",
  "reservation.form.notes.field": "Your notes",
  "reservation.form.notes.placeholder": "e.g. context, goals, questions you'd like to cover…",
  "reservation.form.update.name": "Pre-visit update",
  "reservation.form.update.desc": "A quick check-in so the provider can prepare.",
  "reservation.form.update.field": "Anything changed since you booked?",
  "reservation.message.title": "Message the provider",
  "reservation.message.placeholder": "Write a short message to the provider…",
  "reservation.message.send": "Send message",
  "reservation.message.sent": "Message sent",
  "reservation.message.sentDesc": "Thanks — the provider will get back to you (mocked).",
  "reservation.reschedule.title": "Request a reschedule",
  "reservation.reschedule.body":
    "We'll let the provider know you'd like a different time. They'll follow up to confirm a new slot. (Mocked — nothing is actually sent.)",
  "reservation.reschedule.confirm": "Request reschedule",
  "reservation.reschedule.sent": "Reschedule requested",
  "reservation.reschedule.sentDesc":
    "The provider will follow up about a new time (mocked).",
  "reservation.cancel.title": "Request a cancellation",
  "reservation.cancel.body":
    "We'll let the provider know you'd like to cancel. Any refund follows their cancellation policy. (Mocked — nothing is actually cancelled.)",
  "reservation.cancel.confirm": "Request cancellation",
  "reservation.cancel.sent": "Cancellation requested",
  "reservation.cancel.sentDesc":
    "The provider will follow up about your cancellation (mocked).",
  "reservation.back": "Back to booking page",
  "reservation.backHome": "Back to home",
  "reservation.disclaimer":
    "This is a demo page. Customers don't have accounts — a production version would use a secure link sent by email.",

  // Auth
  "auth.login.submit": "Sign in",
  "auth.register.submit": "Create account",
  "auth.field.email": "Email",
  "auth.field.password": "Password",

  // Forms feature
  "forms.title": "Forms",
  "forms.new": "New form",

  // Demo guide modal
  "demoGuide.eyebrow": "Demo guide",
  "demoGuide.title": "Welcome to Slotera",
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
