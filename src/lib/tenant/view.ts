// What a tenant page may hand to a component: the view half of a resolved token (P3.1,
// src/server/tenant/resolve.ts). Types only, so client components can name them. Every field is
// in D-30; no id, amount, cost or urgency appears here.

export interface TenantHeader {
  /** T01-HDR "Flat 2A" */
  unitLabel: string;
  propertyName: string;
  landlordName: string;
  /** T01-BTN-CALL; null when the landlord has not recorded one. */
  landlordPhone: string | null;
}

export interface TenantRequestView {
  requestNumber: string;
  /** Tenant label of the effective category (D-30). */
  category: string;
  /** DD MMM YYYY, Indian calendar date. */
  reportedOn: string;
  /** T03-CHP-STATUS word (D-30). */
  status: string;
}

export interface OwnRequestView extends TenantRequestView {
  photoCount: number;
}

export type TenantView =
  | { kind: "door"; header: TenantHeader }
  | {
      kind: "tenant";
      header: TenantHeader;
      /** T01-FLD-NAME / T01-FLD-PHONE pre-fill; phone as the ten digits the phone field takes. */
      prefill: { name: string; phone: string };
      requests: TenantRequestView[];
    };
