// D-19: integer rupees, Indian digit grouping, amounts in words with lakh and crore.
import { describe, expect, it } from "vitest";

import {
  formatRupees,
  formatRupeesInWords,
  formatRupeesShort,
  groupIndian,
  numberToWordsIndian,
  parseRupees,
} from "../src/lib/format";

describe("groupIndian (D-19)", () => {
  it("groups the last three digits, then pairs", () => {
    expect(groupIndian(186000)).toBe("1,86,000");
    expect(groupIndian(10000000)).toBe("1,00,00,000");
    expect(groupIndian("1234567890")).toBe("1,23,45,67,890");
  });
  it("leaves short numbers alone", () => {
    expect(groupIndian(0)).toBe("0");
    expect(groupIndian(999)).toBe("999");
    expect(groupIndian(1000)).toBe("1,000");
    expect(groupIndian(99999)).toBe("99,999");
    expect(groupIndian(100000)).toBe("1,00,000");
  });
  it("never produces Western grouping", () => {
    expect(groupIndian(186000)).not.toBe("186,000");
  });
});

describe("formatRupees (D-19)", () => {
  it("prefixes ₹ and groups Indian style", () => {
    expect(formatRupees(186000)).toBe("₹1,86,000");
    expect(formatRupees(18000)).toBe("₹18,000");
    expect(formatRupees(0)).toBe("₹0");
    expect(formatRupees(-4000)).toBe("-₹4,000");
  });
  it("rounds to whole rupees — never decimals", () => {
    expect(formatRupees(4999.6)).toBe("₹5,000");
    expect(formatRupees(18000)).not.toContain(".");
  });
});

describe("formatRupeesShort (stat cards only)", () => {
  it("abbreviates with L, Cr and k", () => {
    expect(formatRupeesShort(210000)).toBe("₹2.1L");
    expect(formatRupeesShort(36000)).toBe("₹36k");
    expect(formatRupeesShort(10000000)).toBe("₹1Cr");
    expect(formatRupeesShort(12500000)).toBe("₹1.3Cr");
    expect(formatRupeesShort(9500)).toBe("₹9,500");
  });
});

describe("parseRupees", () => {
  it("reads digits out of a money field", () => {
    expect(parseRupees("₹1,86,000")).toBe(186000);
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
  });
});

describe("numberToWordsIndian (D-19, P-01 amount in words)", () => {
  it("uses lakh for 1,86,000", () => {
    expect(numberToWordsIndian(186000)).toBe("one lakh eighty-six thousand");
  });
  it("uses crore for 1,00,00,000", () => {
    expect(numberToWordsIndian(10000000)).toBe("one crore");
  });
  it("never says hundred thousand or million", () => {
    expect(numberToWordsIndian(186000)).not.toMatch(/hundred thousand|million/);
    expect(numberToWordsIndian(10000000)).not.toMatch(/million/);
  });
  it("handles every magnitude", () => {
    expect(numberToWordsIndian(0)).toBe("zero");
    expect(numberToWordsIndian(7)).toBe("seven");
    expect(numberToWordsIndian(18)).toBe("eighteen");
    expect(numberToWordsIndian(40)).toBe("forty");
    expect(numberToWordsIndian(99)).toBe("ninety-nine");
    expect(numberToWordsIndian(100)).toBe("one hundred");
    expect(numberToWordsIndian(850)).toBe("eight hundred fifty");
    expect(numberToWordsIndian(1000)).toBe("one thousand");
    expect(numberToWordsIndian(18000)).toBe("eighteen thousand");
    expect(numberToWordsIndian(17500)).toBe("seventeen thousand five hundred");
    expect(numberToWordsIndian(99999)).toBe("ninety-nine thousand nine hundred ninety-nine");
    expect(numberToWordsIndian(100000)).toBe("one lakh");
    expect(numberToWordsIndian(1500000)).toBe("fifteen lakh");
    expect(numberToWordsIndian(5400000)).toBe("fifty-four lakh");
    expect(numberToWordsIndian(10000001)).toBe("one crore one");
    expect(numberToWordsIndian(12345678)).toBe(
      "one crore twenty-three lakh forty-five thousand six hundred seventy-eight",
    );
  });
  it("counts crores in Indian words too", () => {
    expect(numberToWordsIndian(1000000000)).toBe("one hundred crore");
    expect(numberToWordsIndian(12345678901)).toBe(
      "one thousand two hundred thirty-four crore fifty-six lakh seventy-eight thousand nine hundred one",
    );
  });
  it("rounds to whole rupees first", () => {
    expect(numberToWordsIndian(17999.6)).toBe("eighteen thousand");
  });
});

describe("formatRupeesInWords (P-01)", () => {
  it("wraps the words as a receipt prints them", () => {
    expect(formatRupeesInWords(186000)).toBe("Rupees one lakh eighty-six thousand only");
    expect(formatRupeesInWords(10000000)).toBe("Rupees one crore only");
    expect(formatRupeesInWords(18000)).toBe("Rupees eighteen thousand only");
  });
});
