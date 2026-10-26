// Validation for the three forms this lane owns. Pure, so the client shows the same message the
// server would return, and the server re-runs it on every action (never trusting the client).
//
// - L08-BTN-ADDUNIT inline form (D-39): property (or "Add a property…" with name and address),
//   unit number, type, rent, deposit. Unit numbers are unique within a property (D-39).
// - L09-BTN-EDITUNIT † (D-39): number, type, rent, deposit.
// - L09-FRM-ADDTENANT † (D-39): name, phone, email (optional), move-in date, agreement start and
//   end, rent, rent due day, deposit paid, deposit received on. Rent, due day and deposit are required.
import { addDays, isIsoDate, type IsoDate } from "./dates";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** A2 field wording (src/components/ui/field.tsx REQUIRED_MESSAGE). */
const REQUIRED = "This is needed to continue.";
const MAX_TEXT = 120;

/** `unit.type` is free text with suggestions (D-39). */
export const UNIT_TYPE_SUGGESTIONS = ["1RK", "1BHK", "2BHK", "3BHK", "PG bed"] as const;

export function sameUnitNumber(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function duplicateUnitMessage(unitNumber: string, propertyName: string): string {
  return `${propertyName} already has a unit ${unitNumber.trim()}.`;
}

// ---------------------------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------------------------

export interface UnitFields {
  unitNumber: string;
  type: string;
  rent: number | null;
  deposit: number | null;
}

export type UnitField = keyof UnitFields | "propertyId" | "propertyName" | "propertyAddress";

export interface NewUnitInput extends UnitFields {
  /** An existing property, or null when the landlord chose "Add a property…". */
  propertyId: string | null;
  propertyName: string;
  propertyAddress: string;
}

export interface UnitForUniqueness {
  id: string;
  propertyId: string;
  unitNumber: string;
}

function money(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateUnitFields(input: UnitFields): FieldErrors<keyof UnitFields> {
  const errors: FieldErrors<keyof UnitFields> = {};
  const unitNumber = text(input.unitNumber);
  if (!unitNumber) errors.unitNumber = REQUIRED;
  else if (unitNumber.length > 20) errors.unitNumber = "Keep the unit number to 20 characters.";
  if (text(input.type).length > 40) errors.type = "Keep the type to 40 characters.";
  if (input.rent === null || input.rent === undefined) errors.rent = REQUIRED;
  else if (money(input.rent) === null || input.rent === 0) errors.rent = "Enter the monthly rent in whole rupees.";
  if (input.deposit !== null && input.deposit !== undefined && money(input.deposit) === null) {
    errors.deposit = "Enter the deposit in whole rupees.";
  }
  return errors;
}

/** L08-BTN-ADDUNIT. `units` are the landlord's existing units, for the per-property uniqueness rule. */
export function validateNewUnit(
  input: NewUnitInput,
  units: UnitForUniqueness[],
  propertyNames: Map<string, string>,
): FieldErrors<UnitField> {
  const errors: FieldErrors<UnitField> = validateUnitFields(input);
  if (input.propertyId === null) {
    const name = text(input.propertyName);
    if (!name) errors.propertyName = REQUIRED;
    else if (name.length > MAX_TEXT) errors.propertyName = "Keep the name to 120 characters.";
    const address = text(input.propertyAddress);
    if (!address) errors.propertyAddress = REQUIRED;
    else if (address.length > 300) errors.propertyAddress = "Keep the address to 300 characters.";
  } else if (!propertyNames.has(input.propertyId)) {
    errors.propertyId = REQUIRED;
  } else if (
    !errors.unitNumber &&
    units.some((u) => u.propertyId === input.propertyId && sameUnitNumber(u.unitNumber, input.unitNumber))
  ) {
    errors.unitNumber = duplicateUnitMessage(input.unitNumber, propertyNames.get(input.propertyId) ?? "This property");
  }
  return errors;
}

/** L09-BTN-EDITUNIT: the same rules; the unit may keep its own number. */
export function validateUnitEdit(
  unit: UnitForUniqueness,
  input: UnitFields,
  siblings: UnitForUniqueness[],
  propertyName: string,
): FieldErrors<keyof UnitFields> {
  const errors = validateUnitFields(input);
  if (
    !errors.unitNumber &&
    siblings.some((u) => u.id !== unit.id && u.propertyId === unit.propertyId && sameUnitNumber(u.unitNumber, input.unitNumber))
  ) {
    errors.unitNumber = duplicateUnitMessage(input.unitNumber, propertyName);
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------
// Tenancy (L09-FRM-ADDTENANT)
// ---------------------------------------------------------------------------------------------

export interface TenancyFields {
  name: string;
  /** Ten digits, no prefix (A2 Phone field). */
  phone: string;
  email: string;
  movedInOn: IsoDate | "";
  startsOn: IsoDate | "";
  endsOn: IsoDate | "";
  rent: number | null;
  rentDueDay: number | null;
  depositPaid: number | null;
  depositReceivedOn: IsoDate | "";
}

export type TenancyField = keyof TenancyFields;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateTenancy(input: TenancyFields): FieldErrors<TenancyField> {
  const errors: FieldErrors<TenancyField> = {};
  const name = text(input.name);
  if (!name) errors.name = REQUIRED;
  else if (name.length > MAX_TEXT) errors.name = "Keep the name to 120 characters.";

  const phone = text(input.phone);
  if (!phone) errors.phone = REQUIRED;
  else if (!/^\d{10}$/.test(phone)) errors.phone = "Enter the 10-digit mobile number.";

  const email = text(input.email);
  if (email && !EMAIL.test(email)) errors.email = "Enter an email address like name@example.com.";

  if (!input.movedInOn) errors.movedInOn = REQUIRED;
  else if (!isIsoDate(input.movedInOn)) errors.movedInOn = "Choose a date.";

  if (!input.startsOn) errors.startsOn = REQUIRED;
  else if (!isIsoDate(input.startsOn)) errors.startsOn = "Choose a date.";
  else if (isIsoDate(input.movedInOn) && input.startsOn > input.movedInOn) {
    // The first rent row is priced by the agreement in force on the move-in date (D-08, D-24).
    errors.startsOn = "The agreement must start on or before the move-in date.";
  }

  if (!input.endsOn) errors.endsOn = REQUIRED;
  else if (!isIsoDate(input.endsOn)) errors.endsOn = "Choose a date.";
  else if (isIsoDate(input.startsOn) && input.endsOn < input.startsOn) {
    errors.endsOn = "The agreement must end after it starts.";
  }

  if (input.rent === null || input.rent === undefined) errors.rent = REQUIRED;
  else if (money(input.rent) === null || input.rent === 0) errors.rent = "Enter the monthly rent in whole rupees.";

  if (input.rentDueDay === null || input.rentDueDay === undefined) errors.rentDueDay = REQUIRED;
  else if (!Number.isInteger(input.rentDueDay) || input.rentDueDay < 1 || input.rentDueDay > 31) {
    errors.rentDueDay = "Choose a day from 1 to 31.";
  }

  if (input.depositPaid === null || input.depositPaid === undefined) errors.depositPaid = REQUIRED;
  else if (money(input.depositPaid) === null) errors.depositPaid = "Enter the deposit in whole rupees.";

  if (input.depositReceivedOn && !isIsoDate(input.depositReceivedOn)) errors.depositReceivedOn = "Choose a date.";
  else if (!input.depositReceivedOn && (input.depositPaid ?? 0) > 0) {
    errors.depositReceivedOn = "Enter the date the deposit was received.";
  }
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

/** `+91` and ten digits, the stored phone shape (schema check, A2 Phone field). */
export function storedPhone(digits: string): string {
  return `+91${digits.trim()}`;
}

/**
 * The consequence stated when the condition-photo step is skipped (amends D-39; proposed
 * decision in the lane PR). Shown on the step itself and wherever a tenancy has no photos.
 */
export const NO_PHOTOS_CONSEQUENCE = "Without this, a deduction at move-out has no evidence behind it.";

/** L11-BTN-RECORDNOTICE † defaults (D-13): given today, vacating today + 30 days — a form default, not a stored rule. */
export function noticeDefaults(today: IsoDate): { givenOn: IsoDate; vacateOn: IsoDate } {
  return { givenOn: today, vacateOn: addDays(today, 30) };
}
