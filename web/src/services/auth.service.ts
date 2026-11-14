"use client";
import { mockData } from "@/services/adapters/mock-data";
import { apiCurrency } from "./_currency";
import { clearQueryScope, setQueryScope, setSessionVerifier } from "@/api/query-cache";
import { readLang } from "@/lib/i18n";


import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { clearSession, readSession, writeSession } from "@/lib/session";
import { clearWorkspaceCache } from "./settings.service";
import type { Operator, Session, UserRole } from "@/types/auth";
import type { Currency } from "@/types/common";
import { ApiRequestError } from "./_errors";

type LoginRequestDto = components["schemas"]["LoginRequest"];
type SessionResponseDto = components["schemas"]["SessionResponse"];
type PasswordResetRequestDto = components["schemas"]["PasswordResetRequest"];
type PasswordResetConsumeDto = components["schemas"]["PasswordResetConsume"];
type PasswordResetAcceptedDto = components["schemas"]["PasswordResetAccepted"];
type SignupRequestDto = components["schemas"]["SignupRequest"];
type SignupAcceptedDto = components["schemas"]["SignupAccepted"];
type SlugAvailabilityDto = components["schemas"]["SlugAvailability"];
type PasswordChangeDto = components["schemas"]["PasswordChange"];

function seedOperator(): Operator {return mockData<{operator: Operator}>("auth").operator;}

function makeToken(): string {
  return `mock.${Math.random().toString(36).slice(2)}.${Date.now().toString(36)}`;
}

function initialsFor(firstNames: string, lastName: string): string {
  const first = firstNames.trim().split(/\s+/)[0]?.[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  return `${first}${last}`.toUpperCase() || "OP";
}

function mapApiSession(response: SessionResponseDto): Session {
  const { user, workspace } = response;
  const operator: Operator = {
    id: user.id,
    title: user.title ?? undefined,
    firstNames: user.firstNames,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    workspaceName: workspace?.name ?? "Slotera HQ",
    workspaceSlug: workspace?.slug,
    avatarInitials: initialsFor(user.firstNames, user.lastName),
    role: user.role,
  };
  setQueryScope(JSON.stringify([user.id, user.role, workspace?.id]), response.expiresAt, {currency: workspace ? apiCurrency(workspace.currency) : undefined, timezone: workspace?.timezone, language: user.language});
  return { operator, role: user.role, workspaceId: workspace?.id, expiresAt: response.expiresAt, language: user.language, timezone: workspace?.timezone, currency: workspace ? apiCurrency(workspace.currency) : undefined };
}

// Mock mode is the prospect-facing demo: every sign-in lands in the operator
// workspace. The platform (superadmin) area exists only in the real app.
function resolveSeedForEmail(email: string): {
  operator: Operator;
  role: UserRole;
} {
  if (email === seedOperator().email) {
    return {
      operator: { ...seedOperator(), role: "operator_admin" },
      role: "operator_admin",
    };
  }
  return {
    operator: {
      ...seedOperator(),
      id: `op-${Math.random().toString(36).slice(2, 8)}`,
      email,
      role: "operator_admin",
    },
    role: "operator_admin",
  };
}

export async function login(
  email: string,
  password: string,
  rememberMe = false,
): Promise<Session> {
  if (dataSource === "api") {
    restored = null;
    clearQueryScope();
    const payload: LoginRequestDto = {
      email: email.trim().toLowerCase(),
      password,
      rememberMe,
    };
    const response = await apiRequest<SessionResponseDto, LoginRequestDto>(
      "/auth/login",
      { method: "POST", body: payload },
    );
    const session = mapApiSession(response);
    restored = { session, at: Date.now() };
    writeSession(session);
    return session;
  }
  await sleep(220);
  const normalized = email.trim().toLowerCase();
  if (normalized === "wrong@example.com") {
    throw new ApiRequestError(401, "invalid_credentials", "No account matches those credentials.");
  }
  const { operator, role } = resolveSeedForEmail(normalized || seedOperator().email);
  const session: Session = { token: makeToken(), operator, role };
  clearWorkspaceCache();
  writeSession(session);
  return session;
}

/**
 * Self-serve sign-up (real app only — the route 404s in the mock demo). Creates
 * the workspace and an activation-pending owner; the emailed activation link
 * sets the password via /reset-password. No session is created here.
 */
export async function register(input: {
  firstNames: string;
  lastName: string;
  email: string;
  workspaceName: string;
  slug: string;
  currency: Currency;
  termsAccepted: true;
}): Promise<void> {
  if (dataSource === "mock") {
    await sleep(260);
    return;
  }
  await apiRequest<SignupAcceptedDto, SignupRequestDto>("/auth/signup", {
    method: "POST",
    body: {
      firstNames: input.firstNames.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      language: readLang(),
    workspaceName: input.workspaceName.trim(),
      slug: input.slug,
      currency: input.currency,
      termsAccepted: input.termsAccepted,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin",
    },
  });
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (dataSource === "mock") return true;
  const result = await apiRequest<SlugAvailabilityDto>(
    `/auth/signup/slug-availability?slug=${encodeURIComponent(slug)}`,
  );
  return result.available;
}

export async function logout(): Promise<void> {
  restored = null;
  clearQueryScope();
  if (dataSource === "api") {
    try {
      await apiRequest<void>("/auth/logout", { method: "POST", csrf: true });
    } finally {
      restored = null;
      clearQueryScope();
      clearWorkspaceCache();
      clearSession();
    }
    return;
  }
  await sleep(60);
  clearWorkspaceCache();
  clearSession();
}

let restored: { session: Session; at: number } | null = null;
let restoring: Promise<Session | null> | null = null;
export async function restoreSession(force = false): Promise<Session | null> {
  if (dataSource === "mock") return currentSession();
  if (!force && restored && Date.now() - restored.at < 60_000 && Date.parse(restored.session.expiresAt ?? "") > Date.now()) return restored.session;
  return restoring ??= restoreVerifiedSession().finally(() => { restoring = null; });
}
setSessionVerifier(() => restoreSession(true));
async function restoreVerifiedSession(): Promise<Session | null> {
  if (dataSource === "mock") return currentSession();
  try {
    const response = await apiRequest<SessionResponseDto>("/auth/session");
    const session = mapApiSession(response);
    restored = { session, at: Date.now() };
    writeSession(session);
    return session;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      restored = null;
      clearQueryScope();
      clearWorkspaceCache();
      clearSession();
      return null;
    }
    throw error;
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<PasswordResetAcceptedDto, PasswordResetRequestDto>(
      "/auth/password-reset/request",
      { method: "POST", body: { email: email.trim().toLowerCase(), language: readLang() } },
    );
    return;
  }
  await sleep(200);
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void, PasswordResetConsumeDto>("/auth/password-reset/consume", {
      method: "POST",
      body: { token, newPassword },
    });
    clearWorkspaceCache();
    clearSession();
    return;
  }
  await sleep(200);
}

export function currentSession(): Session | null {
  const stored = readSession();
  if (!stored) return null;
  // Older sessions may not have a role; default to operator_admin.
  if (!stored.role) {
    return { ...stored, role: "operator_admin" };
  }
  return stored;
}

export function currentRole(): UserRole | null {
  return currentSession()?.role ?? null;
}

/** Re-verifies the current password; other signed-in devices are signed out. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (dataSource === "mock") {
    await sleep(200);
    return;
  }
  await apiRequest<void, PasswordChangeDto>("/auth/password/change", {
    method: "POST",
    body: { currentPassword, newPassword },
    csrf: true,
  });
}

if (typeof window !== "undefined") window.addEventListener("slotera-auth-expired", () => {
  restored = null;
  clearQueryScope();
  clearWorkspaceCache();
  clearSession();
});

if (typeof window !== "undefined") window.addEventListener("slotera-auth-identity-changed", () => {
  restored = null;
  clearQueryScope();
  clearWorkspaceCache();
});
