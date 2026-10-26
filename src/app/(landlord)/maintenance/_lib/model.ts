// L-06, L-07 · the request as the maintenance screens see it, and the words they use for it.
// Enum values mirror the schema (D-32 status, D-33 category, T-01 urgency, D-29 reported_via).
// Client-safe: no server imports.

export const REQUEST_STATUSES = ["new", "assigned", "in_progress", "done"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const CATEGORIES = [
  "plumbing",
  "electrical",
  "appliance",
  "structural",
  "pest",
  "cleaning",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const URGENCIES = ["urgent", "normal", "low"] as const;
export type Urgency = (typeof URGENCIES)[number];

export type ReportedVia = "tenant_link" | "phone" | "in_person" | "landlord";

/** L-06 Layout: "New · Assigned · In progress · Done". */
export const STATUS_LABEL: Record<RequestStatus, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In progress",
  done: "Done",
};

/** L07-SEL-CATEGORY options; D-33: the landlord-facing label of `other` is "Other". */
export const CATEGORY_LABEL: Record<Category, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  appliance: "Appliance",
  structural: "Structural",
  pest: "Pest",
  cleaning: "Cleaning",
  other: "Other",
};

/** L06-CHP-URGENCY: "Urgent (danger) · Normal (neutral) · Low (muted)". */
export const URGENCY_LABEL: Record<Urgency, string> = {
  urgent: "Urgent",
  normal: "Normal",
  low: "Low",
};
export const URGENCY_TONE = { urgent: "danger", normal: "neutral", low: "muted" } as const;

/** D-29: the "reported by" values a landlord can log (L06-BTN-NEW), "phone call" first. */
export const LANDLORD_REPORTED_VIA = ["phone", "in_person", "landlord"] as const;
export type LandlordReportedVia = (typeof LANDLORD_REPORTED_VIA)[number];

export const REPORTED_VIA_LABEL: Record<ReportedVia, string> = {
  tenant_link: "Tenant link",
  phone: "Phone call",
  in_person: "In person",
  landlord: "Noticed by me",
};

export function isStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value);
}
export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
export function isUrgency(value: unknown): value is Urgency {
  return typeof value === "string" && (URGENCIES as readonly string[]).includes(value);
}

/** One card on L-06 (L06-CRD-REQUEST). */
export interface BoardCard {
  id: string;
  requestNumber: string;
  status: RequestStatus;
  category: Category;
  /** Effective urgency (D-21): the higher of reported and suggested, unless the landlord edited it. */
  urgency: Urgency;
  description: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  vendorId: string | null;
  /** False when the request was logged against a vacant unit (D-29): no tenant to update. */
  hasTenant: boolean;
  createdAt: string;
  /** Signed URL of the first before photo, if any. */
  thumbnailUrl: string | null;
}

export interface PropertyOption {
  id: string;
  name: string;
}

export interface UnitOption {
  id: string;
  label: string;
  propertyId: string;
}

export interface VendorOption {
  id: string;
  name: string;
  /** `+91XXXXXXXXXX`. */
  phone: string;
}
