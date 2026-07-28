"use client";

import authJson from "@/data/mock/auth.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import {
  clearSession,
  readOnboarding,
  readSession,
  writeOnboarding,
  writeSession,
} from "@/lib/session";
import type { OnboardingState, Operator, Session, UserRole } from "@/types/auth";
import { NotImplementedError } from "./_errors";

const SEED_OPERATOR = authJson.operator as Operator;
const SEED_SUPERADMIN = authJson.superadmin as Operator;
const SEED_ONBOARDING = authJson.onboarding as OnboardingState;

function makeToken(): string {
  return `mock.${Math.random().toString(36).slice(2)}.${Date.now().toString(36)}`;
}

function composeDisplayName(input: {
  title?: string;
  firstNames: string;
  lastName: string;
}): string {
  return [input.title, input.firstNames, input.lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

function initialsFor(firstNames: string, lastName: string): string {
  const first = firstNames.trim().split(/\s+/)[0]?.[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  return `${first}${last}`.toUpperCase() || "OP";
}

function resolveSeedForEmail(email: string): {
  operator: Operator;
  role: UserRole;
} {
  if (email === SEED_SUPERADMIN.email) {
    return { operator: { ...SEED_SUPERADMIN, role: "superadmin" }, role: "superadmin" };
  }
  if (email === SEED_OPERATOR.email) {
    return {
      operator: { ...SEED_OPERATOR, role: "operator_admin" },
      role: "operator_admin",
    };
  }
  // Heuristic: treat any address starting with "admin@" or "super@" as superadmin
  // so reviewers can test the role without hard-coding more seed users.
  const looksLikeSuper = /^(admin|super(admin)?)@/i.test(email);
  if (looksLikeSuper) {
    return {
      operator: {
        ...SEED_SUPERADMIN,
        id: `su-${Math.random().toString(36).slice(2, 8)}`,
        email,
        role: "superadmin",
      },
      role: "superadmin",
    };
  }
  return {
    operator: {
      ...SEED_OPERATOR,
      id: `op-${Math.random().toString(36).slice(2, 8)}`,
      email,
      role: "operator_admin",
    },
    role: "operator_admin",
  };
}

export async function login(email: string, _password: string): Promise<Session> {
  if (dataSource !== "mock") throw new NotImplementedError("login");
  await sleep(220);
  const normalized = email.trim().toLowerCase();
  if (normalized === "wrong@example.com") {
    throw new Error("No account matches those credentials.");
  }
  const { operator, role } = resolveSeedForEmail(normalized || SEED_OPERATOR.email);
  const session: Session = { token: makeToken(), operator, role };
  writeSession(session);
  return session;
}

export async function register(input: {
  title?: string;
  firstNames: string;
  lastName: string;
  email: string;
  workspaceName: string;
}): Promise<Session> {
  if (dataSource !== "mock") throw new NotImplementedError("register");
  await sleep(260);
  const firstNames = input.firstNames.trim();
  const lastName = input.lastName.trim();
  const title = input.title?.trim() || undefined;
  const operator: Operator = {
    id: `op-${Math.random().toString(36).slice(2, 8)}`,
    title,
    firstNames,
    lastName,
    name: composeDisplayName({ title, firstNames, lastName }),
    email: input.email.trim().toLowerCase(),
    workspaceName: input.workspaceName,
    avatarInitials: initialsFor(firstNames, lastName),
    createdAtISO: new Date().toISOString(),
    role: "operator_admin",
  };
  const session: Session = {
    token: makeToken(),
    operator,
    role: "operator_admin",
  };
  writeSession(session);
  writeOnboarding({
    service: false,
    availability: false,
    payments: false,
    share: false,
  });
  return session;
}

export async function logout(): Promise<void> {
  await sleep(60);
  clearSession();
}

export async function requestPasswordReset(_email: string): Promise<void> {
  if (dataSource !== "mock") throw new NotImplementedError("requestPasswordReset");
  await sleep(200);
}

export async function resetPassword(
  _token: string,
  _newPassword: string,
): Promise<void> {
  if (dataSource !== "mock") throw new NotImplementedError("resetPassword");
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

export function getOnboarding(): OnboardingState {
  const stored = readOnboarding();
  if (
    stored.service === false &&
    stored.availability === false &&
    stored.payments === false &&
    stored.share === false
  ) {
    return SEED_ONBOARDING;
  }
  return stored;
}

export function markOnboardingStep(
  step: keyof OnboardingState,
  value = true,
): OnboardingState {
  const next = { ...getOnboarding(), [step]: value };
  writeOnboarding(next);
  return next;
}
