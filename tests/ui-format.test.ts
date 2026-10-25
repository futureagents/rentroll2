// D-19 money formatting and the A2 date format, as implemented by the A2 library's
// local formatters (PROMOTE: these move to src/lib with the same behaviour).
import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatRupees,
  formatRupeesShort,
  groupIndian,
  parseRupees,
} from "../src/components/ui/format";

describe("D-19 money", () => {
  it("groups digits the Indian way", () => {
    expect(groupIndian("0")).toBe("0");
    expect(groupIndian("999")).toBe("999");
    expect(groupIndian("1000")).toBe("1,000");
    expect(groupIndian("186000")).toBe("1,86,000");
    expect(groupIndian("12345678")).toBe("1,23,45,678");
    expect(groupIndian("007")).toBe("7");
  });

  it("formats whole rupees with the sign and never decimals", () => {
    expect(formatRupees(186000)).toBe("₹1,86,000");
    expect(formatRupees(0)).toBe("₹0");
    expect(formatRupees(2499.6)).toBe("₹2,500");
    expect(formatRupees(-1500)).toBe("-₹1,500");
  });

  it("abbreviates for stat cards only, in lakh and crore", () => {
    expect(formatRupeesShort(210000)).toBe("₹2.1L");
    expect(formatRupeesShort(200000)).toBe("₹2L");
    expect(formatRupeesShort(36000)).toBe("₹36k");
    expect(formatRupeesShort(9999)).toBe("₹9,999");
    expect(formatRupeesShort(12500000)).toBe("₹1.3Cr");
  });

  it("parses a money field's text to whole rupees or null", () => {
    expect(parseRupees("1,86,000")).toBe(186000);
    expect(parseRupees("₹ 2,500")).toBe(2500);
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
  });
});

describe("A2 dates", () => {
  it("renders DD MMM YYYY from ISO strings and Dates", () => {
    expect(formatDate("2026-10-05")).toBe("05 Oct 2026");
    expect(formatDate("2026-01-31T10:00:00")).toBe("31 Jan 2026");
    expect(formatDate(new Date(2026, 2, 7))).toBe("07 Mar 2026");
  });

  it("is empty for missing or unparseable values", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate(null)).toBe("");
    expect(formatDate("18/10/2026")).toBe("");
    expect(formatDate("2026-13-01")).toBe("");
    expect(formatDate(new Date("nope"))).toBe("");
  });

  it("adds a 24-hour time for timeline stamps", () => {
    expect(formatDateTime(new Date(2026, 9, 16, 9, 5))).toBe("16 Oct 2026, 09:05");
    expect(formatDateTime("not a date")).toBe("");
  });
});
