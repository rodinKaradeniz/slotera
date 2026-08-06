/**
 * English is the canonical message set. Every key here should have a matching
 * (best-effort, demo-grade) entry in `tr.ts` and `de.ts`. Missing keys fall
 * back to English at runtime, so partial translations are safe.
 *
 * Covers high-visibility public surfaces: landing page, the public booking
 * flow, the demo booking page, demo guide, and common action labels — not
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
  "nav.packages": "Packages",
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
  "landing.hero.eyebrow": "For independent consultants, coaches & instructors",
  "landing.hero.title": "Paid bookings, without the calendar chaos.",
  "landing.hero.subtitle":
    "Slotera is a lightweight client workspace for independent experts — take card or bank-transfer payments, send prep forms, bundle sessions into packages, and keep client context and follow-up in one place. No heavy CRM.",
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
  "landing.how.step1.title": "Set up your services",
  "landing.how.step1.body":
    "Add the services you offer with duration, capacity and price — 1:1 or group. Bundle sessions into multi-session packages, and attach intake forms where you need context before the session.",
  "landing.how.step2.title": "Share one booking link",
  "landing.how.step2.body":
    "Clients pick a time, answer your pre-session questions, and pay by card or bank transfer. No account needed.",
  "landing.how.step3.title": "Run the session, stay in sync",
  "landing.how.step3.body":
    "New bookings land in your dashboard. Clients get a booking page to prep, message you, or request a change.",

  // Landing — features
  "landing.features.eyebrow": "Features",
  "landing.features.title":
    "Everything an independent expert needs. Nothing they don't.",
  "landing.features.bookings.title": "Paid bookings",
  "landing.features.bookings.body":
    "Take payment when clients book — card or manual bank transfer, your choice. Clear receipts, no spreadsheet wrangling.",
  "landing.features.forms.title": "Client intake & prep forms",
  "landing.features.forms.body":
    "Collect the context you need before a session. Make key questions required before payment, or optional afterwards.",
  "landing.features.bookingPage.title": "Customer booking page",
  "landing.features.bookingPage.body":
    "After booking, clients get a page to review details, finish optional forms, message you, or request a reschedule.",
  "landing.features.sessions.title": "Sessions & calendar",
  "landing.features.sessions.body":
    "1:1 or group sessions with capacity and spots-left. Overlaps on your calendar are flagged as conflicts.",
  "landing.features.languages.title": "Multilingual booking",
  "landing.features.languages.body":
    "Your clients can book in English, Turkish or German — the whole flow follows their language.",
  "landing.features.workspace.title": "A lightweight client workspace",
  "landing.features.workspace.body":
    "A focused admin for bookings, clients, packages and client notes — built to run your practice, not a heavy CRM.",

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
  "landing.pricing.team.blurb": "For studios and small expert-led teams.",
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
    "Slotera is a lightweight client workspace for independent consultants, coaches and instructors — paid bookings, prep forms, packages and follow-up, without a heavy CRM.",
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

  // Booking — package hint (informational only; no package checkout)
  "booking.packages.hintTitle": "Available in packages",
  "booking.packages.hintBody":
    "This session is included in one or more multi-session packages.",
  "booking.packages.viewOptions": "View package options",
  "booking.packages.modalTitle": "Package options",
  "booking.packages.modalBody":
    "These packages include this session. Buying a package isn't part of this demo — book a single session to continue.",
  "booking.packages.featured": "Featured",
  "booking.packages.sessionsSuffix": "sessions",

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
  "booking.service.approvalRequired": "Provider approval required",

  // Booking — confirmation page
  "booking.confirm.title": "Your booking is confirmed.",
  "booking.confirm.pendingTitle": "Your booking was received.",
  "booking.confirm.emailQueued":
    "A booking email has been queued for {email}.",
  "booking.confirm.pendingApproval": "Waiting for provider approval",
  "booking.confirm.pendingPayment": "Waiting for manual payment confirmation",
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
  "booking.confirm.manage": "Manage booking",
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
    "This booking page isn't currently accepting new bookings. If you need to get in touch, send a message and we'll reply.",
  "booking.paused.cta": "Get in touch",

  // Demo booking management workspace (/booking/manage/demo)
  "bookingManage.badge": "Demo",
  "bookingManage.title": "Your booking",
  "bookingManage.subtitle":
    "A preview of what your clients could see after booking — review the details, complete optional forms, manage the booking, and stay in touch. This is a demo with mocked data.",
  "bookingManage.tabsLabel": "Booking sections",
  "bookingManage.tab.info": "Booking info",
  "bookingManage.tab.manage": "Manage booking",
  "bookingManage.tab.forms": "Forms",
  "bookingManage.tab.payment": "Payment",
  "bookingManage.tab.package": "Package",
  "bookingManage.status.confirmed": "Confirmed",
  "bookingManage.location.online": "Online — meeting link sent by email",
  "bookingManage.reminder":
    "You'll receive a reminder 24 hours before your session.",
  "bookingManage.disclaimer":
    "This is a demo page. Customers don't have accounts — in production this page would open from a secure booking link sent by email.",
  "bookingManage.back": "Back to booking page",
  "bookingManage.backHome": "Back to home",
  // Booking info tab
  "bookingManage.info.title": "Booking info",
  "bookingManage.info.service": "Service",
  "bookingManage.info.provider": "Provider",
  "bookingManage.info.when": "Date & time",
  "bookingManage.info.location": "Location",
  "bookingManage.info.reference": "Booking reference",
  "bookingManage.info.context.none":
    "You're all set — nothing to complete before your session.",
  "bookingManage.info.context.one":
    "1 optional form to complete before your session.",
  "bookingManage.info.context.many":
    "{n} optional forms to complete before your session.",
  // Manage booking tab
  "bookingManage.message.title": "Message your provider",
  "bookingManage.message.note":
    "Ask the provider anything about your booking. They'll follow up by email.",
  "bookingManage.message.placeholder": "Write a short message to the provider…",
  "bookingManage.message.send": "Send message",
  "bookingManage.message.sent": "Message sent",
  "bookingManage.message.sentDesc": "Thanks — the provider will get back to you (mocked).",
  "bookingManage.manage.title": "Manage booking",
  "bookingManage.manage.note":
    "Need to make a change? Send a request and your provider will follow up.",
  "bookingManage.actions.reschedule": "Request reschedule",
  "bookingManage.actions.cancel": "Request cancellation",
  "bookingManage.reschedule.title": "Request a reschedule",
  "bookingManage.reschedule.body":
    "We'll let the provider know you'd like a different time. They'll follow up to confirm a new slot. (Mocked — nothing is actually sent.)",
  "bookingManage.reschedule.confirm": "Request reschedule",
  "bookingManage.reschedule.sent": "Reschedule requested",
  "bookingManage.reschedule.sentDesc":
    "The provider will follow up about a new time (mocked).",
  "bookingManage.cancel.title": "Request a cancellation",
  "bookingManage.cancel.body":
    "We'll let the provider know you'd like to cancel. Any refund follows their cancellation policy. (Mocked — nothing is actually cancelled.)",
  "bookingManage.cancel.confirm": "Request cancellation",
  "bookingManage.cancel.sent": "Cancellation requested",
  "bookingManage.cancel.sentDesc":
    "The provider will follow up about your cancellation (mocked).",
  // Forms tab
  "bookingManage.forms.title": "Forms",
  "bookingManage.forms.note":
    "Forms your provider attached to this booking. Required forms were completed before payment; optional ones you can complete any time before your session.",
  "bookingManage.forms.required": "Required",
  "bookingManage.forms.optional": "Optional",
  "bookingManage.forms.completed": "Completed",
  "bookingManage.forms.notCompleted": "Not completed",
  "bookingManage.forms.open": "Complete",
  "bookingManage.forms.view": "View",
  "bookingManage.forms.save": "Save form",
  "bookingManage.forms.saved": "Form saved",
  "bookingManage.forms.savedDesc": "Thanks — your answers were saved (mocked).",
  "bookingManage.forms.readonlyNote":
    "You completed this form before payment. Your answers are read-only.",
  "bookingManage.form.intake.name": "Discovery questionnaire",
  "bookingManage.form.intake.desc": "Completed before payment.",
  "bookingManage.form.intake.field": "What would you like to focus on?",
  "bookingManage.form.intake.answer":
    "Scaling our onboarding process and improving activation in the first 30 days.",
  "bookingManage.form.notes.name": "Additional notes before your session",
  "bookingManage.form.notes.desc": "Anything you'd like the provider to know in advance.",
  "bookingManage.form.notes.field": "Your notes",
  "bookingManage.form.notes.placeholder": "e.g. context, goals, questions you'd like to cover…",
  "bookingManage.form.update.name": "Pre-session update",
  "bookingManage.form.update.desc": "A quick check-in so the provider can prepare.",
  "bookingManage.form.update.field": "Anything changed since you booked?",
  // Payment tab
  "bookingManage.payment.title": "Payment",
  "bookingManage.payment.method": "Payment method",
  "bookingManage.payment.manualLabel": "Manual payment",
  "bookingManage.payment.statusLabel": "Status",
  "bookingManage.payment.statusValue": "Awaiting manual payment",
  "bookingManage.payment.subtotal": "Subtotal",
  "bookingManage.payment.tax": "Tax",
  "bookingManage.payment.total": "Total",
  "bookingManage.payment.instructionsLabel": "Payment instructions",
  // Package tab
  "bookingManage.package.title": "Package",
  "bookingManage.package.session": "Session {n} of {total}",
  "bookingManage.package.note":
    "This booking is part of a multi-session package set up by your provider.",
  "bookingManage.package.included": "Included sessions",
  "bookingManage.package.thisSession": "This session",

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
  "demoGuide.step.dashboard.title": "See the operator's side — the admin dashboard",
  "demoGuide.step.dashboard.body":
    "Step into the provider's workspace to manage bookings, services, and forms, and explore the calendar and settings.",
  "demoGuide.step.dashboard.cta": "Open admin dashboard",
  "demoGuide.step.booking.title": "Test the public booking page",
  "demoGuide.step.booking.body":
    "See exactly what customers see when they book a service end-to-end.",
  "demoGuide.step.booking.tryAs": "Try it as:",
  "demoGuide.step.booking.defaultLink": "Open the standard booking page",
  "demoGuide.persona.consultant": "Consultant",
  "demoGuide.persona.coach": "Coach",
  "demoGuide.persona.instructor": "Instructor",
  "demoGuide.step.manage.title": "View the customer booking page",
  "demoGuide.step.manage.body":
    "See the post-booking experience: booking details, optional forms, messaging the provider, and requesting a reschedule or cancellation.",
  "demoGuide.step.manage.cta": "Open booking page",
  "demoGuide.noteLabel": "Note:",
  "demoGuide.note":
    "This is a demo environment, so some flows use mocked data while the product is still in progress. If anything looks off, you spot a bug or a broken flow, have a business inquiry or feature request, or would like to book time to discuss Slotera — feel free to reach out.",
  "demoGuide.contact": "Contact us",
  "demoGuide.createAccount": "Create account instead",
  "demoGuide.close": "Close",
  "demoGuide.startExploring": "Start exploring",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
