/**
 * Demo personas are lightweight presentation overrides for the public booking
 * page, applied only when `?demo=<slug>` is present. They change the provider
 * name/title, intro copy, and which seeded services + forms surface — they do
 * NOT swap the underlying workspace, settings, or pricing. Shared seeded data
 * is reused; the app is never duplicated per vertical.
 */
export type DemoPersona = {
  slug: string;
  /** Provider display name shown in the booking topbar + intro. */
  displayName: string;
  /** Short professional title, e.g. "Veterinary clinic". */
  title: string;
  /** A short line shown above the stepper to frame the demo context. */
  intro: string;
  /** Longer paragraph for the consultant-style intro panel. */
  bio: string;
  /** Seeded services this persona offers (filters the Service step). */
  serviceIds: string[];
  /** Seeded forms relevant to this persona (informational). */
  formTemplateIds: string[];
};
