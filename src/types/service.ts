import type { Currency, LocationType, ServiceKind } from "./common";

export type Service = {
  id: string;
  name: string;
  description: string;
  kind: ServiceKind;
  durationMin: number;
  priceCents: number;
  currency: Currency;
  capacity: number;
  locationType: LocationType;
  location: string;
  cancellationRule: string;
  active: boolean;
  createdAtISO: string;
};

export type ServiceInput = Omit<Service, "id" | "createdAtISO">;
