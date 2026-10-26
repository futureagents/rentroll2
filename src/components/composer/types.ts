// S-01 · Shapes passed between the composer's server actions and the client modal.
import type { LadderDays, Level, Tone } from "./ladder";

/**
 * What an opener passes. Only an id: the server loads everything else, including the
 * pre-selected level (D-41), so no screen can pre-select a different tone.
 */
export type ComposerTarget = { kind: "rent_reminder"; rentEntryId: string };

/** Channels that end in "Did you send it?" (D-17). Calls are logged on L-05, not here. */
export type SendChannel = "whatsapp" | "copy" | "email";

/** Everything the rent-reminder composer shows, loaded server-side under RLS (D-04). */
export interface RentReminderContext {
  kind: "rent_reminder";
  rentEntryId: string;
  recipient: {
    name: string;
    firstName: string;
    /** `+91XXXXXXXXXX` (A2 phone field). */
    phone: string;
    email: string | null;
  };
  /** "Flat 4C", or "Flat 4C · Kulkarni Apartments" when the landlord has several properties (D-38). */
  unitLabel: string;
  /** First of the rent month, `YYYY-MM-DD`. */
  month: string;
  dueOn: string;
  /** today − due_on in India time; negative before the due date (D-09). */
  daysOverdue: number;
  amountDue: number;
  /** amount_due − recorded payments (D-10). */
  balance: number;
  ladderDays: LadderDays;
  /** Confirmed `rent_reminder` messages for the entry (S01-CHP-CONTEXT "m sent"). */
  remindersSent: number;
  /** Logged calls for the entry. Count toward the pre-selection (D-41). */
  callsLogged: number;
  preselectedLevel: Level;
  /** For the Formal tone: "our agreement dated <starts_on>" (D-38). */
  agreementStartsOn: string;
  /** Sign-off: receipt name, else the landlord's name. */
  signOff: string;
  /** UPI intent link for S01-CHK-PAYLINK, or null when no UPI ID is saved (D-38). */
  payLink: string | null;
  /** S01-BNR-STALE (D-41, E1-12 / E1-13), or null when the board is current. */
  staleNote: string | null;
}

export type ComposerContext = RentReminderContext;

export type LoadResult =
  | { ok: true; context: ComposerContext }
  | { ok: false; reason: "not_found" | "paid" | "failed" };

export interface ConfirmSentInput {
  /** Client-generated id for the message row, fixed per hand-off, so a retried "Yes" never writes twice. */
  sendId: string;
  rentEntryId: string;
  tone: Tone;
  channel: SendChannel;
  /** Exactly what was handed off, payment link included (D-17 `body`). */
  body: string;
}

export type ConfirmSentResult = { ok: true } | { ok: false };
