/**
 * Structured postal address. Used both for operator-managed places (saved on
 * the workspace) and for per-session addresses (where a one-off group session
 * physically takes place).
 *
 * Country uses an ISO-3166-1 alpha-2 code; the rest are free-form strings
 * because postal/region conventions vary too widely to enforce.
 */
export type Address = {
  street: string;
  /** Unit / suite / apartment / floor — optional second line. */
  street2?: string;
  city: string;
  /** State, province, region, or county. Optional in plenty of countries. */
  region?: string;
  postalCode: string;
  /** ISO-3166-1 alpha-2 (e.g. "DE", "GB"). */
  country: string;
  /** Operator-only notes for getting in: "Buzzer 3, 2nd floor", etc. */
  notes?: string;
};

/**
 * A named place owned by the operator — typically a studio, office, or
 * regularly-used venue. Saved on the workspace so it can be picked when
 * scheduling a session, instead of retyping the address every time.
 */
export type WorkspaceLocation = {
  id: string;
  /** Display name the operator gives the place ("Mitte Studio"). */
  label: string;
  address: Address;
};

export const EMPTY_ADDRESS: Address = {
  street: "",
  street2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "DE",
  notes: "",
};
