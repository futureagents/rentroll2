// D-39: unit numbers are unique within a property, so a unit is always named with its property,
// in the spec's own form (T01-HDR, D-34): "Flat 2A, Kulkarni Apartments".
import { describe, expect, it } from "vitest";

import { compareUnits, unitLabel, unitName } from "../src/lib/display/unit-label";

describe("unitLabel (D-39)", () => {
  it("qualifies the unit with its property, as T01-HDR does", () => {
    expect(unitLabel({ unitNumber: "4C", propertyName: "Kulkarni Apartments" })).toBe("Flat 4C, Kulkarni Apartments");
    expect(unitLabel({ unitNumber: "G1", propertyName: "Shanti Niwas" })).toBe("Flat G1, Shanti Niwas");
  });

  it("tells two buildings' 1A apart", () => {
    const a = unitLabel({ unitNumber: "1A", propertyName: "Kulkarni Apartments" });
    const b = unitLabel({ unitNumber: "1A", propertyName: "Shanti Niwas" });
    expect(a).not.toBe(b);
  });

  it("keeps a unit number the landlord typed with its own word", () => {
    expect(unitLabel({ unitNumber: "Flat 4C", propertyName: "Kulkarni Apartments" })).toBe("Flat 4C, Kulkarni Apartments");
    expect(unitLabel({ unitNumber: "Shop 2", propertyName: "Kulkarni Apartments" })).toBe("Shop 2, Kulkarni Apartments");
    expect(unitName("PG bed 3")).toBe("PG bed 3");
  });

  it("adds Flat to bare codes, including ones with punctuation", () => {
    expect(unitName("B-12")).toBe("Flat B-12");
    expect(unitName("101")).toBe("Flat 101");
  });

  it("trims whitespace", () => {
    expect(unitLabel({ unitNumber: " 4C ", propertyName: " Kulkarni Apartments " })).toBe("Flat 4C, Kulkarni Apartments");
  });

  it("falls back to whichever part exists", () => {
    expect(unitLabel({ unitNumber: "4C" })).toBe("Flat 4C");
    expect(unitLabel({ unitNumber: "4C", propertyName: null })).toBe("Flat 4C");
    expect(unitLabel({ unitNumber: "4C", propertyName: "  " })).toBe("Flat 4C");
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
      "Flat 1B, Kulkarni Apartments",
      "Flat 2A, Kulkarni Apartments",
      "Flat 10A, Kulkarni Apartments",
      "Flat f1, Shanti Niwas",
      "Flat G1, Shanti Niwas",
    ]);
  });
});
