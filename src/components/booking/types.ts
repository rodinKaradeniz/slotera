import type { Service } from "@/types/service";

export type BookingDraft = {
  service: Service | null;
  date: string | null; // ISO date yyyy-mm-dd
  time: string | null; // HH:mm
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
    consent: boolean;
  };
  billing: {
    country: string;
    street: string;
    address2: string;
    zip: string;
    city: string;
    state: string;
  };
  payment: {
    method: "card" | "paypal" | "manual";
    cardNumber: string;
    cardName: string;
    cardExp: string;
    cardCvc: string;
  };
};

export const EMPTY_DRAFT: BookingDraft = {
  service: null,
  date: null,
  time: null,
  customer: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
    consent: false,
  },
  billing: {
    country: "DE",
    street: "",
    address2: "",
    zip: "",
    city: "",
    state: "",
  },
  payment: {
    method: "card",
    cardNumber: "",
    cardName: "",
    cardExp: "",
    cardCvc: "",
  },
};

export type CountryRow = {
  code: string;
  name: string;
  vat: number;
  flag: string;
  vatLabel: string;
};

export const COUNTRIES: CountryRow[] = [
  { code: "DE", name: "Germany",        flag: "🇩🇪", vat: 0.19, vatLabel: "MwSt" },
  { code: "AT", name: "Austria",        flag: "🇦🇹", vat: 0.20, vatLabel: "MwSt" },
  { code: "FR", name: "France",         flag: "🇫🇷", vat: 0.20, vatLabel: "TVA" },
  { code: "NL", name: "Netherlands",    flag: "🇳🇱", vat: 0.21, vatLabel: "BTW" },
  { code: "ES", name: "Spain",          flag: "🇪🇸", vat: 0.21, vatLabel: "IVA" },
  { code: "IT", name: "Italy",          flag: "🇮🇹", vat: 0.22, vatLabel: "IVA" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", vat: 0.20, vatLabel: "VAT" },
];
