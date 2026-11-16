"use client";
import { useContext } from "react";
import { BookingBrandingContext } from "./BookingTheme";
import { BookingFooter } from "@/components/layout/BookingFooter";
export function ClientFooter() {
  return (
    <BookingFooter
      context="client"
      branded={useContext(BookingBrandingContext)}
    />
  );
}
