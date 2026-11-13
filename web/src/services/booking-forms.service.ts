import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import type { FormAnswer } from "@/types/form";

export type BookingFormView = components["schemas"]["BookingFormView"];
type Response = components["schemas"]["BookingFormsResponse"];

export async function listBookingForms(bookingId: string): Promise<BookingFormView[]> {
  if (dataSource === "mock") return [];
  return (await apiRequest<Response>(`/bookings/${encodeURIComponent(bookingId)}/forms`)).items;
}
export async function listManagedForms(token: string): Promise<BookingFormView[]> {
  return (await apiRequest<Response>("/public/bookings/manage/forms", {
    headers: { "X-Booking-Token": token },
  })).items;
}
export async function submitManagedForm(token: string, id: string, answers: FormAnswer[]): Promise<BookingFormView[]> {
  return (await apiRequest<Response, components["schemas"]["BookingFormSubmit"]>(
    `/public/bookings/manage/forms/${encodeURIComponent(id)}/submit`, {
      method: "POST", headers: { "X-Booking-Token": token }, body: { answers },
    })).items;
}
