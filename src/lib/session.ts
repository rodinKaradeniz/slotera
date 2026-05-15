"use client";

import type { OnboardingState, Session } from "@/types/auth";

const SESSION_KEY = "slotera.session";
const ONBOARDING_KEY = "slotera.onboarding";

function isBrowser() {
  return typeof window !== "undefined";
}

export function readSession(): Session | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function readOnboarding(): OnboardingState {
  if (!isBrowser()) return { service: false, availability: false, share: false };
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    return raw
      ? (JSON.parse(raw) as OnboardingState)
      : { service: false, availability: false, share: false };
  } catch {
    return { service: false, availability: false, share: false };
  }
}

export function writeOnboarding(state: OnboardingState): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
}
