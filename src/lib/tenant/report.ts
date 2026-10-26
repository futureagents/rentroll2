// T-01 report: the choices, the validation and every tenant-facing sentence T-01 and T-02 show.
// Client-safe. The form runs validateReport for scroll-to-first-error; the server runs it again on
// every submit and is the only judge (src/server/tenant/submit.ts).
import { groupIndian } from "@/lib/format";

/** D-33: one category enum. */
export const CATEGORIES = ["plumbing", "electrical", "appliance", "structural", "pest", "cleaning", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const URGENCIES = ["low", "normal", "urgent"] as const;
export type Urgency = (typeof URGENCIES)[number];
/** T01-SEG-URGENCY "Defaults to Normal." */
export const DEFAULT_URGENCY: Urgency = "normal";

export type RequestStatus = "new" | "assigned" | "in_progress" | "done";

/** Tenant-facing labels. D-33: `other` is "Something else" for the tenant ("Other" for the landlord). */
export const TENANT_CATEGORY_LABEL: Record<Category, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  appliance: "Appliance",
  structural: "Structural",
  pest: "Pest",
  cleaning: "Cleaning",
  other: "Something else",
};

/** Landlord-facing labels (D-33), used only for photo alt text, which the landlord reads on L-07. */
export const LANDLORD_CATEGORY_LABEL: Record<Category, string> = { ...TENANT_CATEGORY_LABEL, other: "Other" };

export const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: TENANT_CATEGORY_LABEL[value] }));
export const URGENCY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
] as const satisfies readonly { value: Urgency; label: string }[];

/** D-30 status mapping: New → Received; the rest as written. */
export const TENANT_STATUS_WORD: Record<RequestStatus, string> = {
  new: "Received",
  assigned: "Assigned",
  in_progress: "In progress",
  done: "Done",
};

export const DESCRIPTION_MIN = 10; // T01-FLD-DESC "minimum 10 characters"
export const DESCRIPTION_MAX = 2000;
export const NAME_MAX = 80;

/**
 * Tenant-facing sentences. E1 wording rules: never blame, never "error", "invalid", "failed" or
 * "unauthorised", always say what happens next.
 */
export const TENANT_MESSAGES = {
  /** E1-10. Every tenant-side failure shows this and nothing else. */
  invalidLink: "This link is not valid. Please ask your landlord for your unit link.",
  /** E1-08, chosen for T-01 by D-31. */
  offline: "You are offline. We will save this when you reconnect.",
  /** T-01 States "Submission failed". */
  submitFailed: "Could not submit. Please try again.",
  /** T-01 Rules ask for "a plain message"; no wording is given (decisions §9 leaves it open). */
  // The budget is per flat (door sticker and tenant link share it), so it never says "you sent".
  rateLimited: "5 reports have been sent for this flat in the last hour. Please try again later, or call your landlord.",
  /** D-28 replaces "Your landlord has been notified." Nothing notifies the landlord in v1. */
  onTheBoard: "Your landlord will see this on their board.",
  /** D-02: replaces T02-BTN-TRACK under a door token. E1 gives no wording. */
  doorStatusNote: "To check the status, use the link your landlord sent you.",
} as const;

/** E1-06. */
export function reportedMessage(requestNumber: string): string {
  return `Reported. Your request number is ${requestNumber}.`;
}

/** Field errors, shown under the field (T-01 "Validation failure"). The spec gives no wording. */
export const FIELD_MESSAGES = {
  category: "Choose what the problem is.",
  description: `Describe the problem in at least ${DESCRIPTION_MIN} characters.`,
  descriptionLong: `Please keep the description under ${groupIndian(DESCRIPTION_MAX)} characters.`,
  urgency: "Choose how urgent it is.",
  name: `Please keep the name under ${NAME_MAX} characters.`,
  phone: "Enter a 10-digit mobile number.",
} as const;

/** The invisible bot check's honeypot (T-01 Rules): a name browsers do not autofill. */
export const HONEYPOT_FIELD = "t01_leave_empty";

/** The form's fields in reading order; the first one with an error is scrolled to. */
export const REPORT_FIELDS = ["category", "description", "photos", "urgency", "name", "phone"] as const;
export type ReportField = (typeof REPORT_FIELDS)[number];
export type FieldErrors = Partial<Record<ReportField, string>>;

/** What T01-BTN-SUBMIT's server action returns: a request number or a message, never a row. */
export type SubmitResult =
  | { status: "reported"; requestNumber: string }
  | { status: "fields"; errors: FieldErrors }
  /** Shown inline above Submit; the form keeps everything. `stamp` replaces an expired one. */
  | { status: "retry"; message: string; stamp?: string }
  /** The link stopped resolving (the tenancy ended meanwhile): render E1-10. */
  | { status: "invalid-link" };

export interface ReportInput {
  category: string;
  description: string;
  urgency: string;
  name: string;
  phone: string;
}

export interface ValidReport {
  category: Category;
  description: string;
  urgency: Urgency;
  /** Null when left blank (a door-sticker report starts blank, D-02). */
  name: string | null;
  /** `+91` and ten digits, or null when left blank. */
  phone: string | null;
}

const isCategory = (value: string): value is Category => (CATEGORIES as readonly string[]).includes(value);
const isUrgency = (value: string): value is Urgency => (URGENCIES as readonly string[]).includes(value);
const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Ten national digits from whatever was typed ("+91 98765 43210", "98765-43210"), or null. */
export function nationalDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return null;
}

export function validateReport(
  input: ReportInput,
): { ok: true; value: ValidReport } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const category = text(input.category);
  if (!isCategory(category)) errors.category = FIELD_MESSAGES.category;

  const description = text(input.description).trim();
  if (description.length < DESCRIPTION_MIN) errors.description = FIELD_MESSAGES.description;
  else if (description.length > DESCRIPTION_MAX) errors.description = FIELD_MESSAGES.descriptionLong;

  const urgency = text(input.urgency) || DEFAULT_URGENCY;
  if (!isUrgency(urgency)) errors.urgency = FIELD_MESSAGES.urgency;

  const name = text(input.name).trim();
  if (name.length > NAME_MAX) errors.name = FIELD_MESSAGES.name;

  const phoneTyped = text(input.phone).trim();
  const digits = phoneTyped ? nationalDigits(phoneTyped) : null;
  if (phoneTyped && !digits) errors.phone = FIELD_MESSAGES.phone;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      category: category as Category,
      description,
      urgency: urgency as Urgency,
      name: name || null,
      phone: digits ? `+91${digits}` : null,
    },
  };
}

export function firstInvalidField(errors: FieldErrors): ReportField | null {
  return REPORT_FIELDS.find((field) => errors[field]) ?? null;
}

/** T01-HDR "Flat 2A" (the same prefix D-34 uses for the dispatch address). */
export function unitLabel(unitNumber: string): string {
  return `Flat ${unitNumber}`;
}
