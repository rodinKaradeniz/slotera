import type { Service } from "@/types/service";
import type { FormAnswer } from "@/types/form";

export type BookingDraft = {
  service: Service | null;
  date: string | null; // ISO date yyyy-mm-dd
  time: string | null; // HH:mm
  /** Exact server-issued slot instant. API mode never reconstructs this from browser time. */
  startAt: string | null;
  /** Answers keyed by form template id — populated on the conditional Forms step. */
  formResponses: Record<string, FormAnswer[]>;
  /**
   * A signed-in client's package that covers this session. null: use the first package
   * that covers the service; "": the client chose to pay instead.
   */
  packagePurchaseId: string | null;
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
};

export const EMPTY_DRAFT: BookingDraft = {
  service: null,
  date: null,
  time: null,
  startAt: null,
  formResponses: {},
  packagePurchaseId: null,
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
};

export type CountryRow = {
  code: "DE" | "AT" | "FR" | "NL" | "ES" | "IT" | "GB";
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
