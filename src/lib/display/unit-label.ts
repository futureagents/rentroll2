// How a unit is named on screen, in drafts and in exports. Client-safe; imports nothing.
//
// Unit numbers are unique within a property, not across an account (D-39), so "Flat 4C" alone is
// ambiguous for a landlord with two buildings, yet the spec shows the bare form on L-03, L-04 and
// S-01. Every place that names a unit uses `unitLabel`, except a table that already shows the
// property in its own column (L-08). The format is decided once, here, and it is the spec's own
// qualified form (T01-HDR "Flat 2A, Kulkarni Apartments"; D-34 "Flat 2A, Kulkarni Apartments, …"):
//
//   Flat <unit number>, <property name>      →  "Flat 4C, Kulkarni Apartments"
//
// - Always qualified, even for a landlord with one property: a second building can be added at
//   any time, and a label that changes shape when it is would break search, exports and habit.
// - "Flat " is added only when the unit number is a bare code ("4C", "G1", "B-12"). A number the
//   landlord typed with its own word ("Shop 2", "Room 5", "Flat 4C", "PG bed 3") is kept as typed.
// - Nothing is abbreviated or truncated; tables wrap.

export interface UnitLabelInput {
  /** `unit.unit_number`. */
  unitNumber: string;
  /** `property.name`. Missing only if the caller did not select it; the label then names the unit alone. */
  propertyName?: string | null;
}

/** "Flat 4C". The unit on its own, for use only beside an explicit property (a Property column). */
export function unitName(unitNumber: string): string {
  const unit = unitNumber.trim();
  if (unit === "") return "";
  return /^[A-Za-z]+\s/.test(unit) ? unit : `Flat ${unit}`;
}

/** "Flat 4C, Kulkarni Apartments". The one qualified form of a unit's name. */
export function unitLabel({ unitNumber, propertyName }: UnitLabelInput): string {
  const unit = unitName(unitNumber);
  const property = propertyName?.trim() ?? "";
  if (property === "") return unit;
  if (unit === "") return property;
  return `${unit}, ${property}`;
}

/**
 * Sort order for units wherever they are listed: by property name, then by unit number with
 * digits compared as numbers ("2A" before "10A", "G1" before "G2"). Case-insensitive.
 */
export function compareUnits(a: UnitLabelInput, b: UnitLabelInput): number {
  return (
    collator.compare(a.propertyName?.trim() ?? "", b.propertyName?.trim() ?? "") ||
    collator.compare(a.unitNumber.trim(), b.unitNumber.trim())
  );
}

const collator = new Intl.Collator("en-IN", { numeric: true, sensitivity: "base" });
