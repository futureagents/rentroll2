// How a unit is named on screen, in drafts and in exports. Client-safe; imports nothing.
//
// Unit numbers are unique within a property, not across an account (D-39), so "4C" alone is
// ambiguous for a landlord with two buildings, yet the spec shows the bare form on L-03, L-04
// and S-01. Every place that names a unit uses `unitLabel`, except a table that already shows
// the property in its own column (L-08). The format is decided once, here:
//
//   unit number, property name      →  "4C, Kulkarni Apartments"
//
// The unit number comes first because it is what the landlord scans for; the comma reads
// naturally inside a sentence ("Plumbing reported in 4C, Kulkarni Apartments") and matches the
// P-03 QR alt text. Both parts are shown as the landlord typed them (a unit number entered as
// "Flat 4C" stays "Flat 4C, Kulkarni Apartments"); nothing is abbreviated or truncated.

export interface UnitLabelInput {
  /** `unit.unit_number`. */
  unitNumber: string;
  /** `property.name`. Missing only if the caller did not select it; the label then falls back to the unit number. */
  propertyName?: string | null;
}

/** "4C, Kulkarni Apartments". The one qualified form of a unit's name. */
export function unitLabel({ unitNumber, propertyName }: UnitLabelInput): string {
  const unit = unitNumber.trim();
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
