import { readLang, translate } from "@/lib/i18n";
import type { MessageKey } from "@/i18n/messages/en";
export class NotImplementedError extends Error {
  constructor(name: string) {
    super(`${name} is not implemented for the api data source yet.`);
    this.name = "NotImplementedError";
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}

export type ApiErrorDetail = {
  location: (string | number)[];
  message: string;
  type: string;
};

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: ApiErrorDetail[],
  ) {
    const lang = readLang();
    const keys: Record<string, MessageKey> = {
      network_error: "errors.network", invalid_credentials: "errors.credentials",
      csrf_cookie_missing: "errors.session", csrf_failed: "errors.session",
      rate_limit_exceeded: "errors.rateLimit", validation_error: "errors.validation",
      public_slot_unavailable: "errors.slot", booking_capacity_exceeded: "errors.slot",
      booking_form_invalid: "errors.validation", booking_form_closed: "errors.formClosed",
      booking_form_submitted: "errors.formSubmitted", service_in_package: "errors.packageService",
      booking_link_invalid: "errors.bookingLink", customer_change_window_closed: "errors.changeClosed",
    };
    const key = keys[code] ?? (status === 401 ? "errors.session" : status === 403 ? "errors.permission" : status === 404 ? "errors.notFound" : status === 409 ? "errors.conflict" : status === 422 ? "errors.validation" : "errors.unexpected");
    super(lang === "en" ? message : translate(lang, key));
    this.name = "ApiRequestError";
  }
}
