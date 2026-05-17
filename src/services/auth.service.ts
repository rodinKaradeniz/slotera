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
import type { OnboardingState, Operator, Session } from "@/types/auth";
import { NotImplementedError } from "./_errors";

const SEED_OPERATOR = authJson.operator as Operator;
const SEED_ONBOARDING = authJson.onboarding as OnboardingState;

function makeToken(): string {
  return `mock.${Math.random().toString(36).slice(2)}.${Date.now().toString(36)}`;
}

export async function login(email: string, _password: string): Promise<Session> {
  if (dataSource !== "mock") throw new NotImplementedError("login");
  await sleep(220);
  const normalized = email.trim().toLowerCase();
  if (normalized === "wrong@example.com") {
    throw new Error("No account matches those credentials.");
  }
  const operator: Operator =
    normalized === SEED_OPERATOR.email
      ? SEED_OPERATOR
      : {
          ...SEED_OPERATOR,
          id: `op-${Math.random().toString(36).slice(2, 8)}`,
          email: normalized || SEED_OPERATOR.email,
          name: SEED_OPERATOR.name,
        };
  const session: Session = { token: makeToken(), operator };
  writeSession(session);
  return session;
}

export async function register(input: {
  name: string;
  email: string;
  workspaceName: string;
}): Promise<Session> {
  if (dataSource !== "mock") throw new NotImplementedError("register");
  await sleep(260);
  const operator: Operator = {
    id: `op-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    email: input.email.trim().toLowerCase(),
    workspaceName: input.workspaceName,
    avatarInitials: input.name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    createdAtISO: new Date().toISOString(),
  };
  const session: Session = { token: makeToken(), operator };
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
  return readSession();
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
