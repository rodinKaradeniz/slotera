import type { Messages } from "./en";

/** German — demo-grade translations. Missing keys fall back to English. */
export const de: Partial<Messages> = {
  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "common.back": "Zurück",
  "common.continue": "Weiter",
  "common.close": "Schließen",
  "common.edit": "Bearbeiten",
  "common.search": "Suchen",
  "common.loading": "Lädt…",
  "common.new": "Neu",
  "common.active": "Aktiv",
  "common.inactive": "Inaktiv",
  "common.free": "Kostenlos",
  "common.optional": "Optional",

  "nav.dashboard": "Übersicht",
  "nav.calendar": "Kalender",
  "nav.bookings": "Buchungen",
  "nav.clients": "Kunden",
  "nav.services": "Leistungen",
  "nav.forms": "Formulare",
  "nav.settings": "Einstellungen",
  "nav.overview": "Überblick",
  "nav.workspaces": "Arbeitsbereiche",
  "nav.subscriptions": "Abonnements",
  "nav.inquiries": "Anfragen",

  "landing.nav.features": "Funktionen",
  "landing.nav.pricing": "Preise",
  "landing.nav.contact": "Kontakt",
  "landing.nav.demo": "Demo",
  "landing.cta.login": "Anmelden",
  "landing.cta.startTrial": "Kostenlos testen",
  "landing.cta.openDemo": "Demo öffnen",
  "landing.cta.tryDemo": "Demo ausprobieren",

  "landing.hero.eyebrow": "Für Beratende, Coaches & Trainer:innen",
  "landing.hero.title": "Bezahlte Buchungen, ohne Kalender-Chaos.",
  "landing.hero.subtitle":
    "Slotera übernimmt Ihren gesamten Buchungsablauf — Leistungen, Termine, Zahlungen, Kalender, Erinnerungen — damit Sie nicht länger alles über Tabellen organisieren.",
  "landing.hero.badge.noCard": "Keine Kreditkarte nötig",
  "landing.hero.badge.cancel": "Jederzeit kündbar",
  "landing.hero.badge.gdpr": "UK-DSGVO-bewusst",

  "landing.logos.trustedBy":
    "Vertraut von über 1.200 unabhängigen Beratenden, Coaches und Trainer:innen in ganz Europa.",

  "landing.how.eyebrow": "So funktioniert's",
  "landing.how.title":
    "Vom E-Mail-Hin-und-Her zu einem echten Buchungsablauf an einem Nachmittag.",
  "landing.how.step1.title": "Termine definieren",
  "landing.how.step1.body":
    "Legen Sie Ihre Leistungen mit Dauer, Kapazität und Preis an. 1:1 oder Gruppe — Slotera ist das egal.",
  "landing.how.step2.title": "Kalender verbinden",
  "landing.how.step2.body":
    "Synchronisieren Sie Google, Apple oder Outlook. Wir berücksichtigen Ihre Verfügbarkeit und verhindern Doppelbuchungen automatisch.",
  "landing.how.step3.title": "Einen Link teilen",
  "landing.how.step3.body":
    "Kunden wählen einen Termin, zahlen und erhalten den Meeting-Link. Neue Buchungen sehen Sie in Ihrem Dashboard.",

  "landing.features.eyebrow": "Funktionen",
  "landing.features.title":
    "Alles, was ein Einzelunternehmen braucht. Nichts, was es nicht braucht.",
  "landing.features.calendar.title": "Intelligente Kalender-Synchronisierung",
  "landing.features.calendar.body":
    "Zwei-Wege-Sync mit Google, Apple, Outlook. Puffer und Zeitzonen inklusive.",
  "landing.features.payments.title": "Zahlungen auf Stripe-Niveau",
  "landing.features.payments.body":
    "Karten oder manuelle Banküberweisung. Rechnungen und Erstattungen ohne die App zu verlassen.",
  "landing.features.gdpr.title": "UK-DSGVO-bewusst",
  "landing.features.gdpr.body":
    "Mit Blick auf britische Datenschutz-Abläufe entwickelt. Einwilligungsbelege, Aufbewahrungskontrollen, AV-Vertrag auf Anfrage.",
  "landing.features.meeting.title": "Integrierte Meeting-Links",
  "landing.features.meeting.body":
    "Zoom- oder Meet-Links automatisch erzeugen. Oder eine physische Adresse für Vor-Ort-Termine nutzen.",
  "landing.features.reminders.title": "Erinnerungen, die ankommen",
  "landing.features.reminders.body":
    "Intelligente E-Mail- und SMS-Erinnerungen senken No-Shows im Schnitt um 38 %.",
  "landing.features.embed.title": "Einbettbar & im eigenen Branding",
  "landing.features.embed.body":
    "Buchungsseite auf Ihrer Website einbetten oder die gehostete URL nutzen. Ihre Farben, Ihre Schriften.",

  "landing.demoStrip.eyebrow": "In Aktion erleben",
  "landing.demoStrip.title": "Testen Sie einen echten Buchungsablauf. Ohne Anmeldung.",

  "landing.testimonials.eyebrow": "Stimmen",
  "landing.testimonials.title":
    "Selbstständige, denen wir still einen Nachmittag pro Woche zurückgegeben haben.",
  "landing.testimonials.q1":
    "Früher habe ich jede Woche einen halben Tag mit Terminplanung verloren. Slotera hat das auf einen kurzen Check am Sonntagabend reduziert.",
  "landing.testimonials.q2":
    "Die Buchungsseite wirkt wie Teil meiner Website. Kunden merken den Übergang gar nicht.",
  "landing.testimonials.q3":
    "Für Gruppen-Workshops mit Kapazität und Wartelisten brauchte man früher ein CRM. Jetzt sind es zwei Klicks.",

  "landing.pricing.eyebrow": "Preise",
  "landing.pricing.title": "Klare Preise. Jederzeit kündbar.",
  "landing.pricing.monthly": "Monatlich",
  "landing.pricing.yearly": "Jährlich · −20 %",
  "landing.pricing.perMonth": "/Mon.",
  "landing.pricing.custom": "Individuell",
  "landing.pricing.cta.startTrial": "Kostenlos testen",
  "landing.pricing.cta.talk": "Kontakt aufnehmen",
  "landing.pricing.solo.name": "Solo",
  "landing.pricing.solo.blurb":
    "Für Selbstständige, die bezahlte Buchungen live schalten.",
  "landing.pricing.solo.f1": "Unbegrenzte Leistungen",
  "landing.pricing.solo.f2": "Stripe- & manuelle Banküberweisungs-Zahlungen",
  "landing.pricing.solo.f3": "Google- / Apple-Kalender-Sync",
  "landing.pricing.solo.f4": "1 Buchungsseite",
  "landing.pricing.team.name": "Team",
  "landing.pricing.team.blurb": "Für Praxen und Studios mit kleinem Team.",
  "landing.pricing.team.f1": "Alles aus Solo",
  "landing.pricing.team.f2": "Bis zu 10 Teammitglieder",
  "landing.pricing.team.f3": "Gruppentermine & Wartelisten",
  "landing.pricing.team.f4": "Eigenes Branding",
  "landing.pricing.customTier.name": "Individuell",
  "landing.pricing.customTier.blurb":
    "Für Schulen, Netzwerke und Studios an mehreren Standorten.",
  "landing.pricing.customTier.f1": "Alles aus Team",
  "landing.pricing.customTier.f2": "Unbegrenzte Teammitglieder",
  "landing.pricing.customTier.f3": "SSO & Audit-Log",
  "landing.pricing.customTier.f4": "Priorisierter Support & AV-Vertrag",

  "landing.faq.eyebrow": "FAQ",
  "landing.faq.title": "Häufige Fragen.",
  "landing.faq.q1.q": "Brauchen meine Kunden ein Konto?",
  "landing.faq.q1.a":
    "Nein. Kunden buchen und zahlen als Gäste. In Ihrem Dashboard erscheinen sie automatisch als Kunden.",
  "landing.faq.q2.q": "Welche Zahlungsanbieter unterstützen Sie?",
  "landing.faq.q2.a":
    "Stripe (Karten) ist die Standardoption. Manuelle Überweisungshinweise lassen sich für den gesamten Arbeitsbereich aktivieren.",
  "landing.faq.q3.q": "Kann ich Gruppenkurse oder Workshops anbieten?",
  "landing.faq.q3.a":
    "Ja. Setzen Sie die Kapazität auf eine beliebige Zahl über 1. Slotera kümmert sich um freie Plätze und Wartelisten.",
  "landing.faq.q4.q": "Wo werden die Daten gehostet?",
  "landing.faq.q4.a":
    "Slotera ist mit Blick auf britische Datenschutz-Abläufe entwickelt.",
  "landing.faq.q5.q": "Kann ich die Buchungsseite auf meiner Website einbetten?",
  "landing.faq.q5.a":
    "Ja. Sie können entweder auf die gehostete Buchungsseite verlinken oder sie als iframe einbetten. Ihre Farben und Schriften kommen in beiden Fällen durch.",
  "landing.faq.q6.q": "Was passiert, wenn ein Kunde storniert?",
  "landing.faq.q6.a":
    "Stornierungen folgen der Richtlinie, die Sie je Leistung festlegen. Der Termin wird automatisch frei und Erstattungen laufen über denselben Anbieter, mit dem Sie kassiert haben.",

  "landing.finalCta.eyebrow": "Slotera testen",
  "landing.finalCta.title": "Schluss mit der Termin-Jagd.",
  "landing.finalCta.body":
    "Richten Sie Ihre Buchungsseite in unter 10 Minuten ein. 14 Tage kostenlos, keine Kreditkarte nötig.",

  "footer.tagline":
    "Slotera hilft unabhängigen Beratenden und Coaches, ihren Buchungsablauf zu führen — ohne Tabellen, Kalender und Rechnungen zu jonglieren.",
  "footer.col.product": "Produkt",
  "footer.col.company": "Unternehmen",
  "footer.col.legal": "Rechtliches",
  "footer.link.demo": "Demo",
  "footer.link.legal": "Rechtliches",
  "footer.copyright": "© Velora Labs. Slotera ist ein Produkt von Velora Labs.",
  "footer.gdpr": "UK-DSGVO-bewusst",

  "legal.title": "Rechtliches",
  "legal.description":
    "Impressum, Datenschutzhinweis und Nutzungsbedingungen für die Slotera-Demo.",
  "legal.tab.imprint": "Impressum",
  "legal.tab.privacy": "Datenschutz",
  "legal.tab.terms": "Bedingungen",
  "legal.imprint.intro":
    "Slotera ist ein Produkt von Velora Labs. Dies ist eine Demo-Umgebung — das folgende Impressum ist ein Platzhalter, während sich das Produkt in Entwicklung befindet.",
  "legal.imprint.company": "Unternehmen",
  "legal.imprint.contact": "Kontakt",
  "legal.imprint.responsible": "Verantwortlich",

  "contact.eyebrow": "Kontakt",
  "contact.title": "Kontakt aufnehmen",
  "contact.description":
    "Geschäftliche Anfragen, technische Probleme, Funktionswünsche — schreiben Sie uns, wir melden uns.",
  "contact.send": "Nachricht senden",
  "contact.field.name": "Name",
  "contact.field.email": "E-Mail",
  "contact.field.reason": "Anliegen",
  "contact.field.message": "Nachricht",
  "contact.reason.business": "Geschäftliche Anfrage",
  "contact.reason.development": "Technisches Problem",
  "contact.reason.feature": "Funktionswunsch",
  "contact.reason.general": "Allgemeine Anfrage",
  "contact.message.placeholder": "Erzählen Sie uns, worum es geht…",
  "contact.success.title": "Nachricht gesendet.",
  "contact.success.body":
    "Danke für Ihre Nachricht — ein Teammitglied antwortet innerhalb eines Werktags. (Dies ist eine nachgebildete Bestätigung — es wurde nichts tatsächlich gesendet.)",
  "contact.success.bodyPersist":
    "Danke — Slotera meldet sich innerhalb eines Werktags bei Ihnen.",

  "booking.step.service": "Leistung",
  "booking.step.time": "Zeit",
  "booking.step.details": "Angaben",
  "booking.step.forms": "Formulare",
  "booking.step.billing": "Rechnung",
  "booking.step.review": "Überprüfen",
  "booking.step.pay": "Zahlen",
  "booking.back": "Zurück",
  "booking.continue": "Weiter",
  "booking.payConfirm": "Bezahlen und bestätigen",
  "booking.reservePay": "Reservieren und zahlen",
  "booking.confirm": "Buchung bestätigen",

  "booking.topbar.with": "Buchung bei",
  "booking.topbar.secure": "SSL-gesichert · UK-DSGVO-bewusst",
  "booking.footer.secure": "Sichere Kasse · Powered by Slotera",

  "booking.intro.title": "Strategieberater:in",

  "booking.datetime.availableTimes": "Verfügbare Zeiten",
  "booking.datetime.pickDate": "Wählen Sie ein Datum, um verfügbare Zeiten zu sehen.",
  "booking.datetime.prevMonth": "Vorheriger Monat",
  "booking.datetime.nextMonth": "Nächster Monat",

  "booking.details.firstName": "Vorname",
  "booking.details.lastName": "Nachname",
  "booking.details.email": "E-Mail",
  "booking.details.phone": "Telefon",
  "booking.details.company": "Unternehmen",
  "booking.details.notes": "Möchten Sie vor dem Termin etwas mitteilen?",
  "booking.details.consent": "Ich stimme den {terms} zu.",
  "booking.details.consentLink": "Nutzungsbedingungen und der Datenschutzerklärung",

  "booking.legal.title": "Nutzungsbedingungen und Datenschutz",
  "booking.legal.description":
    "Buchungsbedingungen dieses Anbieters sowie die Plattformbedingungen und der Datenschutzhinweis von Slotera.",
  "booking.legal.tab.provider": "Buchungsbedingungen des Anbieters",
  "booking.legal.tab.platform": "Slotera-Bedingungen & Datenschutz",
  "booking.legal.defaultProviderTerms":
    "Dieser Anbieter hat keine eigenen Buchungsbedingungen festgelegt. Es gelten übliche Storno- und Erstattungsregelungen — bei Fragen wenden Sie sich bitte direkt an den Anbieter.",
  "booking.legal.termsHeading": "Bedingungen",
  "booking.legal.privacyHeading": "Datenschutz",

  "booking.field.yes": "Ja",
  "booking.field.no": "Nein",
  "booking.field.select": "Auswählen…",

  "booking.billing.line1": "Adresszeile 1",
  "booking.billing.line1.placeholder": "Straße und Hausnummer",
  "booking.billing.line2": "Adresszeile 2",
  "booking.billing.line2.placeholder": "Einheit, Etage, Wohnung usw.",
  "booking.billing.city": "Stadt",
  "booking.billing.region": "Bundesland / Region / Provinz",
  "booking.billing.country": "Land",
  "booking.billing.postal": "Postleitzahl",

  "booking.review.service": "Leistung",
  "booking.review.when": "Wann",
  "booking.review.details": "Ihre Angaben",
  "booking.review.forms": "Formulare",
  "booking.review.formsCompleted": "{count} Formulare ausgefüllt",
  "booking.review.billing": "Rechnung",
  "booking.review.edit": "Bearbeiten",

  "booking.receipt.paymentReceipt": "Zahlungsbeleg",
  "booking.receipt.orderSummary": "Bestellübersicht",
  "booking.receipt.almostDone": "Fast geschafft",
  "booking.receipt.reviewBooking": "Buchung überprüfen",
  "booking.receipt.service": "Leistung",
  "booking.receipt.client": "Kunde",
  "booking.receipt.billingAddress": "Rechnungsadresse",
  "booking.receipt.subtotal": "Zwischensumme",
  "booking.receipt.total": "Gesamt",
  "booking.receipt.paymentMethod": "Zahlungsart",
  "booking.receipt.manualInstructions": "Hinweise zur manuellen Zahlung",
  "booking.receipt.footerManual":
    "Bei manuellen Zahlungen ist eine Bestätigung des Anbieters erforderlich, bevor Ihre Buchung verbindlich ist.",
  "booking.receipt.footerCard": "Verschlüsselt · PCI-DSS über Stripe (nachgebildet)",
  "booking.receipt.footerReview":
    "Es wird Ihnen nichts berechnet, bis Sie im nächsten Schritt bestätigen.",

  "booking.payment.method": "Zahlungsart",
  "booking.payment.card": "Karte",
  "booking.payment.manual": "Manuelle Zahlung",
  "booking.payment.cardholderName": "Karteninhaber:in",
  "booking.payment.cardNumber": "Kartennummer",
  "booking.payment.cardNumberHint":
    "Nutzen Sie 4242 4242 4242 4242 für einen simulierten Erfolg oder 4000 0000 0000 0002 für einen simulierten Fehler.",
  "booking.payment.expiration": "Ablauf",
  "booking.payment.cvc": "CVC",
  "booking.payment.instructions": "Zahlungshinweise",
  "booking.payment.instructionsFallback":
    "Die Zahlungshinweise werden nach Ihrer Bestätigung mitgeteilt.",
  "booking.payment.pendingNote":
    "Ihre Buchung bleibt ausstehend, bis der Anbieter den Zahlungseingang bestätigt.",

  "booking.confirm.title": "Ihre Buchung ist bestätigt.",
  "booking.confirm.emailSent": "Wir haben eine Bestätigungs-E-Mail an {email} gesendet.",
  "booking.confirm.emailSentNoAddress": "Wir haben eine Bestätigungs-E-Mail gesendet.",
  "booking.confirm.reference": "Referenz {ref}",
  "booking.confirm.service": "Leistung",
  "booking.confirm.when": "Wann",
  "booking.confirm.attendee": "Teilnehmer:in",
  "booking.confirm.meetingLink": "Meeting-Link",
  "booking.confirm.copyLink": "Meeting-Link kopieren",
  "booking.confirm.copied": "Kopiert",
  "booking.confirm.bookAnother": "Weiteren Termin buchen",
  "booking.confirm.manage": "Reservierung verwalten",
  "booking.confirm.addCalendar.title": "Zum Kalender hinzufügen",
  "booking.confirm.addCalendar.body": "Google · Apple · Outlook · ICS",
  "booking.confirm.invoice.title": "Rechnung herunterladen",
  "booking.confirm.invoice.body": "PDF, abrechnungsbereit",
  "booking.confirm.forward.title": "E-Mail weiterleiten",
  "booking.confirm.forward.body": "Kollegin oder Kollegen einbeziehen",

  "booking.failure.title": "Zahlung abgelehnt.",
  "booking.failure.body":
    "Diese Karte konnte nicht verarbeitet werden. Sie können eine andere Karte versuchen oder eine andere Zahlungsart wählen.",
  "booking.failure.backToPayment": "Zurück zur Zahlung",
  "booking.failure.cancel": "Buchung abbrechen",

  "booking.paused.title": "Buchungen sind pausiert",
  "booking.paused.body":
    "Diese Buchungsseite nimmt derzeit keine neuen Reservierungen an. Wenn Sie Kontakt aufnehmen möchten, schreiben Sie uns und wir antworten.",
  "booking.paused.cta": "Kontakt aufnehmen",

  "reservation.badge": "Demo",
  "reservation.title": "Ihre Reservierung",
  "reservation.subtitle":
    "Eine Vorschau dessen, was Ihre Kunden nach der Buchung sehen könnten — Details prüfen, optionale Formulare ausfüllen und in Kontakt bleiben. Dies ist eine Demo mit nachgebildeten Daten.",
  "reservation.summary.title": "Reservierungsübersicht",
  "reservation.summary.service": "Leistung",
  "reservation.summary.provider": "Anbieter",
  "reservation.summary.when": "Datum & Uhrzeit",
  "reservation.summary.status": "Status",
  "reservation.summary.location": "Ort",
  "reservation.summary.payment": "Zahlung",
  "reservation.summary.reference": "Referenz",
  "reservation.status.confirmed": "Bestätigt",
  "reservation.status.pendingPayment": "Zahlung ausstehend",
  "reservation.location.online": "Online — Meeting-Link per E-Mail gesendet",
  "reservation.payment.manualLabel": "Manuelle Zahlung",
  "reservation.payment.instructionsLabel": "Zahlungshinweise",
  "reservation.actions.title": "Wie geht es weiter",
  "reservation.actions.formsLabel": "Optionale Formulare ausfüllen",
  "reservation.actions.formsHint": "Ein paar kurze Fragen vor Ihrem Termin.",
  "reservation.actions.messageLabel": "Nachricht senden",
  "reservation.actions.messageHint": "Fragen Sie den Anbieter alles zu Ihrer Buchung.",
  "reservation.actions.rescheduleLabel": "Verschiebung anfragen",
  "reservation.actions.rescheduleHint": "Andere Zeit nötig? Fragen Sie nach einem neuen Termin.",
  "reservation.actions.cancelLabel": "Stornierung anfragen",
  "reservation.actions.cancelHint": "Teilen Sie dem Anbieter mit, dass Sie nicht können.",
  "reservation.forms.title": "Optionale Formulare",
  "reservation.forms.note":
    "Diese waren vor der Zahlung nicht erforderlich. Sie können sie jetzt oder jederzeit vor Ihrem Termin ausfüllen.",
  "reservation.forms.completedBadge": "Ausgefüllt",
  "reservation.forms.optionalBadge": "Optional",
  "reservation.forms.save": "Formular speichern",
  "reservation.forms.saved": "Formular gespeichert",
  "reservation.forms.savedDesc": "Danke — Ihre Antworten wurden gespeichert (nachgebildet).",
  "reservation.form.notes.name": "Zusätzliche Notizen vor Ihrem Termin",
  "reservation.form.notes.desc": "Alles, was der Anbieter vorab wissen sollte.",
  "reservation.form.notes.field": "Ihre Notizen",
  "reservation.form.notes.placeholder": "z. B. Kontext, Ziele, Fragen, die Sie besprechen möchten…",
  "reservation.form.update.name": "Update vor dem Termin",
  "reservation.form.update.desc": "Ein kurzes Update, damit sich der Anbieter vorbereiten kann.",
  "reservation.form.update.field": "Hat sich seit der Buchung etwas geändert?",
  "reservation.message.title": "Anbieter benachrichtigen",
  "reservation.message.placeholder": "Schreiben Sie dem Anbieter eine kurze Nachricht…",
  "reservation.message.send": "Nachricht senden",
  "reservation.message.sent": "Nachricht gesendet",
  "reservation.message.sentDesc": "Danke — der Anbieter meldet sich bei Ihnen (nachgebildet).",
  "reservation.reschedule.title": "Verschiebung anfragen",
  "reservation.reschedule.body":
    "Wir teilen dem Anbieter mit, dass Sie eine andere Zeit wünschen. Er meldet sich, um einen neuen Termin zu bestätigen. (Nachgebildet — es wird nichts tatsächlich gesendet.)",
  "reservation.reschedule.confirm": "Verschiebung anfragen",
  "reservation.reschedule.sent": "Verschiebung angefragt",
  "reservation.reschedule.sentDesc":
    "Der Anbieter meldet sich wegen einer neuen Zeit (nachgebildet).",
  "reservation.cancel.title": "Stornierung anfragen",
  "reservation.cancel.body":
    "Wir teilen dem Anbieter mit, dass Sie stornieren möchten. Eine etwaige Erstattung richtet sich nach seiner Stornorichtlinie. (Nachgebildet — es wird nichts tatsächlich storniert.)",
  "reservation.cancel.confirm": "Stornierung anfragen",
  "reservation.cancel.sent": "Stornierung angefragt",
  "reservation.cancel.sentDesc":
    "Der Anbieter meldet sich wegen Ihrer Stornierung (nachgebildet).",
  "reservation.back": "Zurück zur Buchungsseite",
  "reservation.backHome": "Zurück zur Startseite",
  "reservation.disclaimer":
    "Dies ist eine Demo-Seite. Kunden haben keine Konten — eine Produktionsversion würde einen sicheren, per E-Mail gesendeten Link verwenden.",

  "auth.login.submit": "Anmelden",
  "auth.register.submit": "Konto erstellen",
  "auth.field.email": "E-Mail",
  "auth.field.password": "Passwort",

  "forms.title": "Formulare",
  "forms.new": "Neues Formular",

  "demoGuide.eyebrow": "Demo-Anleitung",
  "demoGuide.title": "Willkommen bei Slotera",
  "demoGuide.disclaimer":
    "Dies ist eine Demoversion von Slotera, die die wichtigsten Buchungs- und Admin-Abläufe zeigt. Einige Funktionen sind nachgebildet, während das Produkt noch entwickelt wird.",
  "demoGuide.youCanTry": "Sie können Folgendes ausprobieren:",
  "demoGuide.step.dashboard.title": "Die Anbieterseite ansehen — das Admin-Dashboard",
  "demoGuide.step.dashboard.body":
    "Schlüpfen Sie in den Arbeitsbereich des Anbieters, um Buchungen, Leistungen und Formulare zu verwalten und Kalender und Einstellungen zu erkunden.",
  "demoGuide.step.dashboard.cta": "Admin-Dashboard öffnen",
  "demoGuide.step.booking.title": "Öffentliche Buchungsseite testen",
  "demoGuide.step.booking.body":
    "Sehen Sie genau, was Kundinnen und Kunden bei einer Buchung sehen.",
  "demoGuide.step.booking.tryAs": "Ausprobieren als:",
  "demoGuide.step.booking.defaultLink": "Standard-Buchungsseite öffnen",
  "demoGuide.persona.consultant": "Berater",
  "demoGuide.persona.vet": "Tierarzt",
  "demoGuide.persona.therapist": "Therapeut",
  "demoGuide.persona.trainer": "Personal Trainer",
  "demoGuide.step.reservation.title": "Die Kunden-Reservierungsseite ansehen",
  "demoGuide.step.reservation.body":
    "Sehen Sie das Erlebnis nach der Buchung: Reservierungsdetails, optionale Formulare, Nachrichten an den Anbieter sowie Anfragen zur Umbuchung oder Stornierung.",
  "demoGuide.step.reservation.cta": "Reservierungsseite öffnen",
  "demoGuide.noteLabel": "Hinweis:",
  "demoGuide.note":
    "Dies ist eine Demo-Umgebung, daher verwenden einige Abläufe nachgebildete Daten, während das Produkt noch entwickelt wird. Falls etwas nicht stimmt, Sie einen Fehler oder einen defekten Ablauf entdecken, eine geschäftliche Anfrage oder einen Funktionswunsch haben oder Slotera besprechen möchten, melden Sie sich gern.",
  "demoGuide.contact": "Kontakt aufnehmen",
  "demoGuide.createAccount": "Stattdessen Konto erstellen",
  "demoGuide.close": "Schließen",
  "demoGuide.startExploring": "Loslegen",
};
