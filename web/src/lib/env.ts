export type DataSource = "mock" | "api";

export const dataSource: DataSource =
  (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource) ?? "mock";

export const apiBaseUrl: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const csrfCookieName: string =
  process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "slotera_csrf";

/** Self-serve sign-up in the real app. Off during the invite-only pilot. */
export const signupOpen: boolean = process.env.NEXT_PUBLIC_SIGNUP_OPEN !== "false";

/** The real app's origin, for links from the mock demo (e.g. the pilot form). */
export const appUrl: string = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
