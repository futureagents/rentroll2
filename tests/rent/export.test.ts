// L04-BTN-EXPORT (D-40): CSV of the current filtered view, `rent-YYYY-MM.csv`, UTF-8 with BOM,
// "Amount (₹)" headers over plain integer cells, YYYY-MM-DD dates.
import { describe, expect, it } from "vitest";

import { rentCsv, rentCsvFilename } from "@/app/(landlord)/rent/_lib/export";
import { deriveRentState } from "@/app/(landlord)/rent/_lib/status";

const row = (over: Partial<Parameters<typeof rentCsv>[0][number]> = {}) => ({
  unitNumber: "4C",
  propertyName: "Kulkarni Apartments",
  tenantName: "Suresh Khan",
  dueOn: "2026-10-05",
  isProRata: false,
  state: deriveRentState({ amountDue: 18_000, dueOn: "2026-10-05" }, [], "2026-10-23"),
  ...over,
});

describe("rent CSV (D-40)", () => {
  it("names the file after the month", () => {
    expect(rentCsvFilename("2026-02")).toBe("rent-2026-02.csv");
  });

  it("starts with a BOM so Excel shows ₹ in the header, and uses CRLF rows", () => {
    const csv = rentCsv([row()]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe(
      "﻿Property,Unit,Tenant,Rent (₹),Due date,Status,Paid (₹),Pending (₹),Pro-rata",
    );
  });

  it("writes plain integer amounts and ISO dates, never ₹1,86,000 or 05 Oct 2026", () => {
    const csv = rentCsv([
      row({ state: deriveRentState({ amountDue: 186_000, dueOn: "2026-10-05" }, [{ amount: 100_000, status: "recorded" }], "2026-10-23") }),
    ]);
    expect(csv.split("\r\n")[1]).toBe("Kulkarni Apartments,4C,Suresh Khan,186000,2026-10-05,18 days late,100000,86000,No");
  });

  it("quotes cells with commas, quotes or line breaks", () => {
    const csv = rentCsv([row({ tenantName: 'Khan, "Suresh"', propertyName: "Shanti Niwas" })]);
    expect(csv.split("\r\n")[1]).toContain('"Khan, ""Suresh"""');
  });

  it("neutralises cells that a spreadsheet would run as a formula", () => {
    const csv = rentCsv([row({ tenantName: "=HYPERLINK(\"x\")" })]);
    expect(csv.split("\r\n")[1]).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("marks pro-rata rows", () => {
    expect(rentCsv([row({ isProRata: true })]).split("\r\n")[1].endsWith(",Yes")).toBe(true);
  });
});
