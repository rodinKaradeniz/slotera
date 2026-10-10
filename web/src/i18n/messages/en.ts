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
  "landing.cta.contact": "Get in touch",
  "landing.cta.openDemo": "Open demo",
  "landing.cta.tryDemo": "Try the demo",
  "landing.cta.joinPilot": "Join the pilot",

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
  "landing.pricing.title": "Two plans. Try either free for 30 days.",
  "landing.pricing.monthly": "Monthly",
  "landing.pricing.yearly": "Yearly",
  "landing.pricing.yearlySave": "2 months free",
  "landing.pricing.perMonth": "/mo",
  "landing.pricing.perYear": "/yr",
  "landing.pricing.cta.start": "Start free trial",
  "landing.pricing.essentials.name": "Essentials",
  "landing.pricing.essentials.blurb": "Everything you need to run bookings, clients and payments.",
  "landing.pricing.essentials.fee": "+ 2% per card payment",
  "landing.pricing.professional.name": "Professional",
  "landing.pricing.professional.blurb": "A lower cut and your own brand, for busier practices.",
  "landing.pricing.professional.fee": "+ 1% per card payment",
  "landing.pricing.f1": "Unlimited services, clients and bookings",
  "landing.pricing.f2": "Public booking page with prep forms",
  "landing.pricing.f3": "Client notes and session follow-up",
  "landing.pricing.f4": "Manual bank-transfer payments",
  "landing.pricing.plus": "Everything in Essentials, plus:",
  "landing.pricing.p1": "No Slotera branding on your client pages",
  "landing.pricing.p2": "Priority support",
  "landing.pricing.p3": "WhatsApp reminders and changes (coming soon)",
  "landing.pricing.note": "30-day free trial, no card needed. The per-payment cut applies to card payments only, on top of Stripe's processing fee; bank transfers are never charged.",

  // Landing — FAQ
  "landing.faq.eyebrow": "FAQ",
  "landing.faq.title": "Common questions.",
  "landing.faq.q1.q": "Do my clients need an account?",
  "landing.faq.q1.a":
    "No. Clients book as guests and get an email link to view, reschedule or cancel their booking. They appear in your client list automatically.",
  "landing.faq.q2.q":
    "How do clients pay?",
  "landing.faq.q2.a":
    "Today you add your own payment instructions (for example bank transfer), and Slotera tracks what's paid. Online card payments are coming next.",
  "landing.faq.q3.q": "Can I run group classes or workshops?",
  "landing.faq.q3.a":
    "Yes. Create a scheduled service, add sessions with any capacity, and clients book until it's full. Slotera shows the spots left.",
  "landing.faq.q4.q": "Where are you hosted?",
  "landing.faq.q4.a":
    "On servers in the EU. Slotera is built with UK data protection workflows in mind.",
  "landing.faq.q5.q":
    "How do clients find my booking page?",
  "landing.faq.q5.a":
    "Every workspace gets its own booking link. Share it on your site, in your email signature or on social media.",
  "landing.faq.q6.q": "What happens if a client cancels?",
  "landing.faq.q6.a":
    "Clients can cancel or reschedule themselves until the cutoff you set (24 hours by default). After that they contact you. You handle any refund directly.",

  // Landing — final CTA
  "landing.finalCta.eyebrow": "Try Slotera",
  "landing.finalCta.title": "Stop chasing slots.",
  "landing.finalCta.body": "Spin up your booking page in under 10 minutes. 30-day free trial, no credit card required.",
  // Pilot waitlist (/pilot, real app)
  "pilot.eyebrow": "Pilot programme",
  "pilot.title": "Help shape Slotera.",
  "pilot.body": "We're opening Slotera to a small group of coaches, consultants and instructors first. Tell us a little about your practice and we'll be in touch.",
  "pilot.perk1": "3 months free, then your founding price for as long as you stay",
  "pilot.perk2": "A direct line to the people building it",
  "pilot.perk3": "Early access to WhatsApp reminders",
  "pilot.field.name": "Your name",
  "pilot.field.email": "Email",
  "pilot.field.business": "Business name",
  "pilot.field.businessType": "What do you do?",
  "pilot.field.country": "Country",
  "pilot.field.volume": "Bookings per month",
  "pilot.field.whatsapp": "I'm interested in WhatsApp reminders and changes for my clients",
  "pilot.field.message": "Anything else we should know?",
  "pilot.field.consent": "I agree that Slotera may keep these details and email me about the pilot.",
  "pilot.privacyLink": "Privacy Policy",
  "pilot.type.coaching": "Coaching",
  "pilot.type.consulting": "Consulting",
  "pilot.type.fitness": "Fitness or wellness instruction",
  "pilot.type.workshops": "Workshops or classes",
  "pilot.type.other": "Something else",
  "pilot.volume.under_20": "Under 20",
  "pilot.volume.20_50": "20–50",
  "pilot.volume.50_150": "50–150",
  "pilot.volume.over_150": "Over 150",
  "pilot.submit": "Apply for the pilot",
  "pilot.success.title": "Thanks, you're on the list.",
  "pilot.success.body": "We'll email you within a few days. Pilot places are limited, so we invite people in small groups.",
  "pilot.error": "Something went wrong. Please try again in a moment.",
  "pilot.rateLimited": "Too many attempts. Please try again later.",

  // Footer
  "footer.tagline":
    "Slotera is a lightweight client workspace for independent consultants, coaches and instructors — paid bookings, prep forms, packages and follow-up, without a heavy CRM.",
  "footer.col.product": "Product",
  "footer.col.company": "Company",
  "footer.link.support": "Support",
  "footer.col.legal": "Legal",
  "footer.link.demo": "Demo",
  "footer.copyright": "© Merulio Ltd. Slotera is a product by Merulio.",
  "footer.gdpr": "UK GDPR-aware",

  // Public legal modal (landing)
  "legal.tab.privacy": "Privacy",
  "legal.tab.terms": "Terms",
  "legal.tab.dpa": "Data processing",
  "booking.legal.platformIntro": "Slotera runs this booking page for the provider. How Slotera handles your data is set out here:",

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
  "booking.footer.secureOnly": "Secure checkout",
  "booking.calendar.title": "Add to your calendar",
  "booking.calendar.ics": "Apple / Outlook (.ics)",
  "booking.calendar.google": "Google Calendar",
  "booking.calendar.eventTitle": "{service} with {provider}",
  "booking.calendar.note": "To change or cancel, use the link in your confirmation email.",
  "booking.meeting.label": "Meeting link",
  "booking.meeting.join": "Join online",

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
  "booking.confirm.where": "Where",
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

  "booking.datetime.spotsLeft": "{count} left",
  // Customer booking link (/booking/manage)
  "manage.eyebrow": "Your booking",
  "manage.loading": "Loading your booking…",
  "manage.invalid.title": "This link doesn't work.",
  "manage.invalid.body": "The link may have expired. Use the newest email about this booking, or contact the provider.",
  "manage.status.confirmed": "Confirmed",
  "manage.status.pending": "Pending",
  "manage.status.cancelled": "Cancelled",
  "manage.status.completed": "Completed",
  "manage.status.noshow": "Missed",
  "manage.pending.approval": "Waiting for the provider to approve.",
  "manage.pending.payment": "Waiting for your payment.",
  "manage.when": "When",
  "manage.where": "Where",
  "manage.provider": "Provider",
  "manage.amount": "Amount",
  "manage.paymentDue": "Payment due {date}",
  "manage.paymentInstructions": "Payment instructions",
  "manage.policy": "Cancellation policy",
  "manage.changeUntil": "You can change this booking online until {date}.",
  "manage.changeClosed": "Online changes are closed for this booking. To change it, contact {name}.",
  "manage.rescheduleOnce": "You've already moved this booking once. To change it again, contact {name}.",
  "manage.reschedule": "Pick a new time",
  "manage.reschedule.confirm": "Move to this time",
  "manage.reschedule.cancel": "Keep current time",
  "manage.reschedule.done": "Your booking has been moved.",
  "manage.cancel": "Cancel booking",
  "manage.cancel.title": "Cancel this booking?",
  "manage.cancel.body": "Your seat is released. Any refund is handled by the provider under their cancellation policy.",
  "manage.cancel.keep": "Keep booking",
  "manage.cancel.done": "Your booking has been cancelled.",
  "manage.contact": "Contact",

  // System pages — 404 and maintenance
  "system.notFound.eyebrow": "404",
  "system.notFound.title": "This page doesn't exist.",
  "system.notFound.body":
    "The link may be broken, or the page may have moved. Head back and try again from there.",
  "system.notFound.home": "Back to home",
  "system.maintenance.eyebrow": "Scheduled maintenance",
  "system.maintenance.title": "We'll be right back.",
  "system.maintenance.body":
    "Slotera is being updated. Your bookings and data are safe — please check back in a few minutes.",
  "system.maintenance.retry": "Try again",

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
