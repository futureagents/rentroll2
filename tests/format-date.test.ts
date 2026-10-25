// A2: dates display as DD MMM YYYY; D-40: CSV cells are YYYY-MM-DD. Phone display.
import { describe, expect, it } from "vitest";

import { formatDate, formatDateCsv, formatDateTime, formatMonth, formatPhone } from "../src/lib/format";

describe("formatDate (A2)", () => {
  it("renders DD MMM YYYY from ISO dates", () => {
    expect(formatDate("2026-10-05")).toBe("05 Oct 2026");
    expect(formatDate("2026-02-28")).toBe("28 Feb 2026");
    expect(formatDate("2026-10-05T10:30:00Z")).toBe("05 Oct 2026");
  });
  it("renders Date objects in local time", () => {
    expect(formatDate(new Date(2026, 0, 9))).toBe("09 Jan 2026");
  });
  it("is empty for anything unparseable", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("05/10/2026")).toBe("");
    expect(formatDate("2026-13-01")).toBe("");
    expect(formatDate(new Date("nope"))).toBe("");
  });
});

describe("formatDateTime", () => {
  it("appends HH:MM", () => {
    expect(formatDateTime(new Date(2026, 9, 5, 9, 7))).toBe("05 Oct 2026, 09:07");
  });
});

describe("formatMonth (P-01 month)", () => {
  it("names the month from YYYY-MM or a date in it", () => {
    expect(formatMonth("2026-10")).toBe("October 2026");
    expect(formatMonth("2026-02-15")).toBe("February 2026");
    expect(formatMonth(new Date(2026, 11, 1))).toBe("December 2026");
    expect(formatMonth("")).toBe("");
  });
});

describe("formatDateCsv (D-40)", () => {
  it("writes YYYY-MM-DD", () => {
    expect(formatDateCsv("2026-10-05")).toBe("2026-10-05");
    expect(formatDateCsv(new Date(2026, 0, 9))).toBe("2026-01-09");
    expect(formatDateCsv(null)).toBe("");
  });
});

describe("formatPhone", () => {
  it("spaces +91 numbers in fives", () => {
    expect(formatPhone("+919000000001")).toBe("+91 90000 00001");
    expect(formatPhone("+91 90000-00001")).toBe("+91 90000 00001");
  });
  it("passes anything else through", () => {
    expect(formatPhone("020 2543 1234")).toBe("020 2543 1234");
    expect(formatPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
  });
});
