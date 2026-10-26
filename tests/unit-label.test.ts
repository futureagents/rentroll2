// D-39: unit numbers are unique within a property, so a unit is always named with its property.
import { describe, expect, it } from "vitest";

import { compareUnits, unitLabel } from "../src/lib/display/unit-label";

describe("unitLabel (D-39)", () => {
  it("qualifies the unit number with its property", () => {
    expect(unitLabel({ unitNumber: "4C", propertyName: "Kulkarni Apartments" })).toBe("4C, Kulkarni Apartments");
    expect(unitLabel({ unitNumber: "G1", propertyName: "Shanti Niwas" })).toBe("G1, Shanti Niwas");
  });

  it("tells two buildings' 1A apart", () => {
    const a = unitLabel({ unitNumber: "1A", propertyName: "Kulkarni Apartments" });
    const b = unitLabel({ unitNumber: "1A", propertyName: "Shanti Niwas" });
    expect(a).not.toBe(b);
  });

  it("keeps the landlord's own wording and trims whitespace", () => {
    expect(unitLabel({ unitNumber: " Flat 4C ", propertyName: " Kulkarni Apartments " })).toBe(
      "Flat 4C, Kulkarni Apartments",
    );
  });

  it("falls back to whichever part exists", () => {
    expect(unitLabel({ unitNumber: "4C" })).toBe("4C");
    expect(unitLabel({ unitNumber: "4C", propertyName: null })).toBe("4C");
    expect(unitLabel({ unitNumber: "4C", propertyName: "  " })).toBe("4C");
    expect(unitLabel({ unitNumber: "", propertyName: "Shanti Niwas" })).toBe("Shanti Niwas");
  });
});

describe("compareUnits", () => {
  it("sorts by property, then unit number with digits as numbers", () => {
    const units = [
      { unitNumber: "10A", propertyName: "Kulkarni Apartments" },
      { unitNumber: "G1", propertyName: "Shanti Niwas" },
      { unitNumber: "2A", propertyName: "Kulkarni Apartments" },
      { unitNumber: "f1", propertyName: "Shanti Niwas" },
      { unitNumber: "1B", propertyName: "Kulkarni Apartments" },
    ];
    expect([...units].sort(compareUnits).map(unitLabel)).toEqual([
      "1B, Kulkarni Apartments",
      "2A, Kulkarni Apartments",
      "10A, Kulkarni Apartments",
      "f1, Shanti Niwas",
      "G1, Shanti Niwas",
    ]);
  });
});
