import type { ClientInput } from "@/types/client";
import type { MessageKey } from "@/i18n/messages/en";
export type ClientIdentity = Pick<ClientInput, "name" | "email" | "phone" | "company">;
export function validEmail(value: string): boolean {
  return value.trim().length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
export function validateClientIdentity(value: ClientIdentity): Partial<Record<keyof ClientIdentity, MessageKey>> {
  const errors: Partial<Record<keyof ClientIdentity, MessageKey>> = {};
  if (!value.name.trim()) errors.name = "booking.create.nameRequired";
  else if (value.name.trim().length > 160) errors.name = "booking.create.tooLong";
  if (!validEmail(value.email)) errors.email = "booking.create.emailInvalid";
  if ((value.phone?.length ?? 0) > 40) errors.phone = "booking.create.tooLong";
  if ((value.company?.length ?? 0) > 160) errors.company = "booking.create.tooLong";
  return errors;
}
