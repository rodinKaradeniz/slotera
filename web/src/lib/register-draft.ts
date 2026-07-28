"use client";

import type { BillingCycle, PlanId } from "@/types/billing";

/**
 * Mock-world session-storage helpers for the registration draft.
 *
 * In the Phase 7 flow, the operator's account is NOT created on /register —
 * it's only created at the end of /register/payment, so a Custom-plan path
 * (which diverts to a contact inquiry) doesn't accidentally provision an
 * account. Until then, the form data is held here.
 *
 * Mirror of `src/lib/session.ts` — only this module touches the storage key.
 */

const DRAFT_KEY = "slotera.register.draft";

export type RegisterDraft = {
  title?: string;
  customTitle?: string;
  firstNames: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  workspaceName: string;
  businessType: string;
  planId?: PlanId;
  billingCycle?: BillingCycle;
};

export const EMPTY_REGISTER_DRAFT: RegisterDraft = {
  title: "Dr.",
  customTitle: "",
  firstNames: "Lena Maria",
  lastName: "Hartmann",
  email: "lena@hartmannstrategy.com",
  password: "",
  confirmPassword: "",
  workspaceName: "Hartmann Strategy",
  businessType: "Consultant / advisor",
};

export function readRegisterDraft(): RegisterDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RegisterDraft;
  } catch {
    return null;
  }
}

export function writeRegisterDraft(draft: RegisterDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // session storage may be unavailable (private mode, quota); silently no-op
  }
}

export function clearRegisterDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Resolve the effective title — '__other__' means the operator typed something
 * custom, in which case we use that string; otherwise the picker value.
 */
export function resolveTitle(draft: RegisterDraft): string | undefined {
  if (draft.title === "__other__") return draft.customTitle?.trim() || undefined;
  return draft.title?.trim() || undefined;
}
