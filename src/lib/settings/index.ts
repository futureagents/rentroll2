// L-15 · Settings — the one shape of the landlord's settings, its defaults, and the validation
// both the screen (on blur) and the server (on every save) run. Client-safe: nothing here reads
// the database. The reader is `getLandlordSettings` in src/server/settings, and every screen that
// needs a setting (S-01's ladder, S-02's UPI ID, P-01's receipt name and logo, L-12's escalation
// default, L-14's accountant email) reads it from there rather than querying `landlord` itself.
//
// Columns (D-20, D-56): name, phone, email, upi_id, receipt_name, logo_document_id,
// signature_document_id, escalation_default_pct, ladder_days, accountant_email. There is no PAN column; PAN is not on
// L-15 until a schema ticket adds `landlord.pan`.
import { TONES, parseLadderDays, type LadderDays, type Tone } from "@/components/composer/ladder";

export { parseLadderDays, type LadderDays };

export interface LandlordSettings {
  /** False when no landlord row was visible (signed out, or the sign-up trigger has not run). */
  saved: boolean;
  /** L15-FLD-NAME † (D-20). */
  name: string;
  /** Sign-in email. Read only here; changed through Supabase Auth (schema §7). */
  email: string;
  /** L15-FLD-PHONE † (D-20). `+91` and ten digits, or null. */
  phone: string | null;
  /** L15-FLD-UPI. `name@handle`, or null. */
  upiId: string | null;
  /** L15-FLD-RECEIPTNAME. Null means "use `name`" (D-26). */
  receiptName: string | null;
  /** L15-UPL-LOGO (D-15). */
  logoDocumentId: string | null;
  /**
   * L15-UPL-SIGNATURE † (D-56). Landlord-printed P-01 and P-02 only; never tenant-readable (D-30),
   * so it never reaches anything a tenant link renders.
   */
  signatureDocumentId: string | null;
  /** L15-FLD-ESCDEFAULT. Null until set; L12-FLD-ESCALATION then shows 0 (D-20). */
  escalationDefaultPct: number | null;
  /** L15-TBL-LADDER: the first day each tone applies, counted from `due_on` (D-09, D-20, D-41). */
  ladderDays: LadderDays;
  /** L15-FLD-CAEMAIL, used by L14-BTN-EMAILCA. */
  accountantEmail: string | null;
}

/**
 * The column default of `landlord.ladder_days` (D-20), and the only place the app spells it.
 * Used only when no landlord row is visible; a saved row always carries its own days.
 */
export const DEFAULT_LADDER_DAYS: LadderDays = [3, 10, 20];

/** What a landlord with no row yet gets. Matches the column defaults in the schema. */
export const SETTINGS_DEFAULTS: LandlordSettings = {
  saved: false,
  name: "",
  email: "",
  phone: null,
  upiId: null,
  receiptName: null,
  logoDocumentId: null,
  signatureDocumentId: null,
  escalationDefaultPct: null,
  ladderDays: DEFAULT_LADDER_DAYS,
  accountantEmail: null,
};

/** The receipt name P-01 prints (D-26): the saved receipt name, else the landlord's own name. */
export function displayReceiptName(settings: Pick<LandlordSettings, "receiptName" | "name">): string {
  return settings.receiptName?.trim() || settings.name;
}

/** L15-TBL-LADDER rows. The three levels and their tones are fixed; only the days are edited. */
export const LADDER_LEVELS: readonly { level: 1 | 2 | 3; tone: Tone; label: string }[] = TONES.map((t) => ({
  level: t.level,
  tone: t.value,
  label: t.label,
}));

// ---------------------------------------------------------------------------------------------
// Validation. Each check returns the sentence the field shows, or null. Plain words, never
// "invalid" (E1 wording rules); each one says what a right value looks like.
// ---------------------------------------------------------------------------------------------

export const REQUIRED = "This is needed to continue.";
const NAME_MAX = 120;
const RECEIPT_NAME_MAX = 80;
const EMAIL_MAX = 254;
const UPI_MAX = 100;
/** Same shape the schema checks (`landlord.upi_id`, L-02). */
const UPI_SHAPE = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const LADDER_MIN_DAY = 1;
export const LADDER_MAX_DAY = 60;

export function upiProblem(text: string): string | null {
  const value = text.trim();
  if (value === "") return null;
  const example = "for example anil.kulkarni@okhdfcbank";
  if (/\s/.test(value)) return `A UPI ID has no spaces, ${example}.`;
  const at = value.split("@").length - 1;
  if (at === 0) return `A UPI ID has an @ in the middle, ${example}. Your UPI app shows yours on its profile page.`;
  if (at > 1) return `A UPI ID has only one @, ${example}.`;
  if (value.length > UPI_MAX) return `That is longer than any UPI ID, ${example}.`;
  if (!UPI_SHAPE.test(value)) {
    return "Use letters, numbers, dots, dashes or underscores before the @, and letters, numbers, dots or dashes after it.";
  }
  return null;
}

export function receiptNameProblem(text: string): string | null {
  return text.trim().length > RECEIPT_NAME_MAX
    ? `Keep it to ${RECEIPT_NAME_MAX} characters so it fits on one line of the receipt.`
    : null;
}

export function nameProblem(text: string): string | null {
  const value = text.trim();
  if (value === "") return REQUIRED;
  return value.length > NAME_MAX ? `Keep it to ${NAME_MAX} characters.` : null;
}

/** `digits` as the A2 phone field holds them: up to ten digits, no +91. Optional. */
export function phoneProblem(digits: string): string | null {
  if (digits === "") return null;
  return /^\d{10}$/.test(digits) ? null : "Enter the 10-digit mobile number.";
}

export function emailProblem(text: string): string | null {
  const value = text.trim();
  if (value === "") return null;
  if (value.length > EMAIL_MAX || !EMAIL_SHAPE.test(value)) return "An email address looks like name@example.com.";
  return null;
}

/** L15-FLD-ESCDEFAULT: empty, or 0–100 with at most two decimals (`numeric(5,2)`). */
export function escalationProblem(text: string): string | null {
  const value = text.trim();
  if (value === "") return null;
  const n = parseEscalation(value);
  return n === null ? "Enter a percentage from 0 to 100, for example 5 or 7.5." : null;
}

export function parseEscalation(text: string): number | null {
  const value = text.trim().replace(/%$/, "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const n = Number(value);
  return n >= 0 && n <= 100 ? n : null;
}

/** One ladder day on its own: a whole number of days, 1–60 (D-20). */
export function ladderDayProblem(text: string): string | null {
  const value = text.trim();
  if (value === "") return REQUIRED;
  if (!/^\d+$/.test(value)) return `Enter a whole number of days, from ${LADDER_MIN_DAY} to ${LADDER_MAX_DAY}.`;
  const n = Number(value);
  if (n < LADDER_MIN_DAY || n > LADDER_MAX_DAY) return `Enter a day from ${LADDER_MIN_DAY} to ${LADDER_MAX_DAY}.`;
  return null;
}

/**
 * The problem for ladder row `index` (0-based) given all three typed values: its own shape first,
 * then that it comes after the row above (D-20: ascending). Shown on the later row, which is the
 * one the landlord has to change.
 */
export function ladderRowProblem(texts: readonly [string, string, string], index: 0 | 1 | 2): string | null {
  const own = ladderDayProblem(texts[index]);
  if (own) return own;
  if (index === 0) return null;
  const prev = texts[index - 1];
  if (ladderDayProblem(prev)) return null;
  const above = LADDER_LEVELS[index - 1];
  if (Number(texts[index]) <= Number(prev)) {
    return `${LADDER_LEVELS[index].label} must start after ${above.label}, which starts on day ${Number(prev)}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Sections. Each saves on its own (L-15 save-behaviour OPEN; proposed decision in the lane PR).
// Inputs are what the fields hold; `parse…` re-runs every check and returns column values.
// ---------------------------------------------------------------------------------------------

export type SectionId = "payment" | "reminders" | "contacts";

export const SECTION_NAMES: Record<SectionId, string> = {
  payment: "Payment",
  reminders: "Reminders",
  contacts: "Contacts",
};

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type Parsed<T, K extends string> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors<K> };

/** The two images Payment holds (D-15, D-56), each a `document` row of that type with no unit. */
export type ImageKind = "logo" | "signature";
export const IMAGE_KINDS: readonly ImageKind[] = ["logo", "signature"];

/** What happens to an image when Payment is saved. `documentId` is the S-04 upload ref. */
export type ImageChange = { action: "keep" } | { action: "remove" } | { action: "replace"; documentId: string; fileName: string };

export interface PaymentInput {
  upiId: string;
  receiptName: string;
  logo: ImageChange;
  signature: ImageChange;
}
export type PaymentField = "upiId" | "receiptName" | ImageKind;

export function parsePayment(input: PaymentInput): Parsed<{ upi_id: string | null; receipt_name: string | null }, PaymentField> {
  const fieldErrors: FieldErrors<PaymentField> = {};
  const upi = upiProblem(input.upiId);
  if (upi) fieldErrors.upiId = upi;
  const receipt = receiptNameProblem(input.receiptName);
  if (receipt) fieldErrors.receiptName = receipt;
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, value: { upi_id: input.upiId.trim() || null, receipt_name: input.receiptName.trim() || null } };
}

export interface RemindersInput {
  ladderDays: [string, string, string];
  escalationDefaultPct: string;
}
export type RemindersField = "day1" | "day2" | "day3" | "escalationDefaultPct";
export const LADDER_FIELDS = ["day1", "day2", "day3"] as const;

export function parseReminders(
  input: RemindersInput,
): Parsed<{ ladder_days: LadderDays; escalation_default_pct: number | null }, RemindersField> {
  const fieldErrors: FieldErrors<RemindersField> = {};
  ([0, 1, 2] as const).forEach((i) => {
    const problem = ladderRowProblem(input.ladderDays, i);
    if (problem) fieldErrors[LADDER_FIELDS[i]] = problem;
  });
  const esc = escalationProblem(input.escalationDefaultPct);
  if (esc) fieldErrors.escalationDefaultPct = esc;
  const days = parseLadderDays(input.ladderDays.map((d) => Number(d.trim())));
  if (Object.keys(fieldErrors).length || !days) return { ok: false, fieldErrors };
  const pct = input.escalationDefaultPct.trim();
  return { ok: true, value: { ladder_days: days, escalation_default_pct: pct === "" ? null : parseEscalation(pct) } };
}

export interface ContactsInput {
  name: string;
  /** Ten digits, no +91, or "". */
  phone: string;
  accountantEmail: string;
}
export type ContactsField = keyof ContactsInput;

export function parseContacts(
  input: ContactsInput,
): Parsed<{ name: string; phone: string | null; accountant_email: string | null }, ContactsField> {
  const fieldErrors: FieldErrors<ContactsField> = {};
  const name = nameProblem(input.name);
  if (name) fieldErrors.name = name;
  const digits = input.phone.replace(/\D/g, "");
  const phone = phoneProblem(digits);
  if (phone) fieldErrors.phone = phone;
  const email = emailProblem(input.accountantEmail);
  if (email) fieldErrors.accountantEmail = email;
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      name: input.name.trim(),
      phone: digits === "" ? null : `+91${digits}`,
      accountant_email: input.accountantEmail.trim() || null,
    },
  };
}

/** `+91` and ten digits → the ten digits the A2 phone field holds. */
export function phoneDigits(stored: string | null): string {
  return stored ? stored.replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10) : "";
}

/** The result every section save returns. `error` is the inline line above the section (E1-07). */
export type SaveResult<K extends string> = { ok: true } | { ok: false; error: string; fieldErrors?: FieldErrors<K> };

/** E1-07. */
export const SAVE_FAILED = "Could not save. Your changes are still here — try again.";
/** A save the server refused for a field: nothing was written, the field says why. */
export const CHECK_FIELDS = "Nothing was saved yet. Check the field marked below, then save again.";
