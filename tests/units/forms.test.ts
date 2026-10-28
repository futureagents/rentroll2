// Form rules for L08-BTN-ADDUNIT, L09-BTN-EDITUNIT and L09-FRM-ADDTENANT (D-39), the units.csv
// export (D-40) and the upload path rule that keeps one landlord out of another's files (E4-7).
import { describe, expect, it } from "vitest";

import {
  cleanFileName,
  isOwnStoragePath,
  MAX_UPLOAD_BYTES,
  NOT_SUPPORTED,
  TOO_LARGE,
  uploadProblem,
} from "../../src/app/(landlord)/units/_lib/files";
import {
  defaultDepositDate,
  depositDateWarning,
  hasErrors,
  validateNewUnit,
  validateTenancy,
  validateUnitEdit,
  type TenancyFields,
} from "../../src/app/(landlord)/units/_lib/forms";
import { csvCell, unitsCsv } from "../../src/app/(landlord)/units/_lib/units-csv";

const properties = new Map([
  ["p-kulkarni", "Kulkarni Apartments"],
  ["p-shanti", "Shanti Niwas"],
]);
const units = [
  { id: "u-4c", propertyId: "p-kulkarni", unitNumber: "4C" },
  { id: "u-g1", propertyId: "p-shanti", unitNumber: "G1" },
];
const newUnit = {
  propertyId: "p-kulkarni" as string | null,
  propertyName: "",
  propertyAddress: "",
  unitNumber: "5A",
  type: "2BHK",
  rent: 18000 as number | null,
  deposit: null as number | null,
};

describe("add unit (L08-BTN-ADDUNIT, D-39)", () => {
  it("accepts a new number in an existing property, deposit optional", () => {
    expect(validateNewUnit(newUnit, units, properties)).toEqual({});
  });
  it("refuses a number the same property already has, whatever its case", () => {
    expect(validateNewUnit({ ...newUnit, unitNumber: " 4c " }, units, properties).unitNumber).toBe(
      "Kulkarni Apartments already has a unit 4c.",
    );
  });
  it("allows the same number in a different property — unique per property, not globally", () => {
    expect(validateNewUnit({ ...newUnit, propertyId: "p-shanti", unitNumber: "4C" }, units, properties)).toEqual({});
  });
  it("needs a name and address when adding a property", () => {
    const errors = validateNewUnit({ ...newUnit, propertyId: null }, units, properties);
    expect(Object.keys(errors).sort()).toEqual(["propertyAddress", "propertyName"]);
  });
  it("needs unit number and rent; rent is whole rupees above zero", () => {
    const errors = validateNewUnit({ ...newUnit, unitNumber: " ", rent: null }, units, properties);
    expect(Object.keys(errors).sort()).toEqual(["rent", "unitNumber"]);
    expect(validateNewUnit({ ...newUnit, rent: 18000.5 }, units, properties).rent).toBeDefined();
    expect(validateNewUnit({ ...newUnit, rent: 0 }, units, properties).rent).toBeDefined();
  });
  it("refuses a property that is not the landlord's", () => {
    expect(validateNewUnit({ ...newUnit, propertyId: "p-someone-else" }, units, properties).propertyId).toBeDefined();
  });
});

describe("edit unit (L09-BTN-EDITUNIT, D-39)", () => {
  it("lets a unit keep its own number but not take a sibling's", () => {
    const unit = units[0];
    const fields = { unitNumber: "4C", type: "", rent: 18000, deposit: 54000 };
    expect(validateUnitEdit(unit, fields, units, "Kulkarni Apartments")).toEqual({});
    const siblings = [...units, { id: "u-4b", propertyId: "p-kulkarni", unitNumber: "4B" }];
    expect(validateUnitEdit(unit, { ...fields, unitNumber: "4B" }, siblings, "Kulkarni Apartments").unitNumber).toBe(
      "Kulkarni Apartments already has a unit 4B.",
    );
  });
});

describe("tenant form (L09-FRM-ADDTENANT, D-39)", () => {
  const valid: TenancyFields = {
    name: "Meera Desai",
    phone: "9876543210",
    email: "",
    movedInOn: "2026-11-16",
    startsOn: "2026-11-16",
    endsOn: "2027-10-31",
    rent: 18000,
    rentDueDay: 5,
    depositPaid: 54000,
    depositReceivedOn: "2026-11-10",
  };
  it("accepts a complete form with no email", () => {
    expect(validateTenancy(valid)).toEqual({});
  });
  it("requires rent, due day and deposit", () => {
    const errors = validateTenancy({ ...valid, rent: null, rentDueDay: null, depositPaid: null, depositReceivedOn: "" });
    expect(Object.keys(errors).sort()).toEqual(["depositPaid", "rent", "rentDueDay"]);
  });
  it("allows a zero deposit with no received date, but asks for the date otherwise", () => {
    expect(validateTenancy({ ...valid, depositPaid: 0, depositReceivedOn: "" })).toEqual({});
    expect(validateTenancy({ ...valid, depositReceivedOn: "" }).depositReceivedOn).toBeDefined();
  });
  it("keeps the due day within 1–31", () => {
    expect(validateTenancy({ ...valid, rentDueDay: 0 }).rentDueDay).toBeDefined();
    expect(validateTenancy({ ...valid, rentDueDay: 32 }).rentDueDay).toBeDefined();
    expect(validateTenancy({ ...valid, rentDueDay: 31 })).toEqual({});
  });
  it("needs a ten-digit phone and a well-formed email when one is given", () => {
    expect(validateTenancy({ ...valid, phone: "98765" }).phone).toBeDefined();
    expect(validateTenancy({ ...valid, email: "meera@" }).email).toBeDefined();
  });
  it("needs the agreement to cover the move-in date and end after it starts", () => {
    expect(validateTenancy({ ...valid, startsOn: "2026-11-17" }).startsOn).toBeDefined();
    expect(validateTenancy({ ...valid, endsOn: "2026-11-01" }).endsOn).toBeDefined();
    expect(validateTenancy({ ...valid, startsOn: "2026-11-01" })).toEqual({});
  });
  it("rejects dates that do not exist", () => {
    expect(validateTenancy({ ...valid, movedInOn: "2026-02-30" }).movedInOn).toBeDefined();
  });
  it("reports whether anything is wrong", () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ name: "x" })).toBe(true);
  });
  it("refuses a deposit received after today, and allows today or earlier", () => {
    const today = "2026-11-12";
    expect(validateTenancy({ ...valid, depositReceivedOn: "2026-11-13" }, today).depositReceivedOn).toMatch(/future/);
    expect(validateTenancy({ ...valid, depositReceivedOn: today }, today)).toEqual({});
    expect(validateTenancy({ ...valid, depositReceivedOn: "2026-11-10" }, today)).toEqual({});
    // A tenancy added ahead of its move-in with the deposit already in hand.
    expect(validateTenancy({ ...valid, depositReceivedOn: "2026-11-01" }, "2026-11-05")).toEqual({});
  });
});

describe("the deposit date (L09-FRM-ADDTENANT, D-23, D-39)", () => {
  it("defaults to the move-in date, or today when the move-in is still ahead", () => {
    expect(defaultDepositDate("2026-10-28", "2026-10-28")).toBe("2026-10-28");
    expect(defaultDepositDate("2026-09-15", "2026-10-28")).toBe("2026-09-15");
    expect(defaultDepositDate("2026-11-16", "2026-10-28")).toBe("2026-10-28");
    expect(defaultDepositDate("", "2026-10-28")).toBe("");
  });
  it("says back a date two months or more from move-in, either side, without blocking it", () => {
    expect(depositDateWarning("2026-10-26", "2026-10-28")).toBeNull();
    expect(depositDateWarning("2026-09-01", "2026-10-28")).toBeNull();
    expect(depositDateWarning("2026-08-29", "2026-10-28")).toBe("This is 2 months before the move-in date. Check the date is right.");
    expect(depositDateWarning("2027-01-28", "2026-10-28")).toBe("This is 3 months after the move-in date. Check the date is right.");
    // A wrong year is the typo this exists for.
    expect(depositDateWarning("2025-10-26", "2026-10-28")).toBe("This is 12 months before the move-in date. Check the date is right.");
    expect(depositDateWarning("", "2026-10-28")).toBeNull();
  });
});

describe("units.csv (D-40)", () => {
  const csv = unitsCsv([
    { unitNumber: "4C", propertyName: "Kulkarni Apartments", type: "2BHK", rent: 18000, deposit: 54000, tenantName: "Rohit Sharma", statusLabel: "Occupied" },
    { unitNumber: "G1", propertyName: "Shanti Niwas, Kothrud", type: null, rent: 10000, deposit: 0, tenantName: null, statusLabel: "Vacant" },
  ]);
  it("starts with a BOM and puts ₹ in the header only", () => {
    expect(csv.startsWith("\uFEFFUnit,Property,Type,Rent amount (₹),Deposit amount (₹),Current tenant,Status\r\n")).toBe(true);
    expect(csv).toContain("4C,Kulkarni Apartments,2BHK,18000,54000,Rohit Sharma,Occupied\r\n");
  });
  it("quotes commas and leaves empty cells empty", () => {
    expect(csv).toContain('G1,"Shanti Niwas, Kothrud",,10000,0,,Vacant\r\n');
  });
  it("stops a typed formula from running", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("uploads (S-04, D-15, E4-7)", () => {
  const landlord = "3f0f6c2e-6d7a-4c1b-9a51-1f2e3d4c5b6a";
  const doc = "7b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
  it("accepts only the path the server signs: the landlord's folder and the document id", () => {
    expect(isOwnStoragePath(landlord, doc, `${landlord}/${doc}`)).toBe(true);
    expect(isOwnStoragePath(landlord, doc, `9a9a9a9a-6d7a-4c1b-9a51-1f2e3d4c5b6a/${doc}`)).toBe(false);
    expect(isOwnStoragePath(landlord, doc, `${landlord}/../x/${doc}`)).toBe(false);
    expect(isOwnStoragePath(landlord, "not-a-uuid", `${landlord}/not-a-uuid`)).toBe(false);
  });
  it("takes photos for move-in and PDFs too for documents, up to 10 MB", () => {
    expect(uploadProblem("move_in_photo", "image/jpeg", 400_000)).toBeNull();
    expect(uploadProblem("move_in_photo", "application/pdf", 400_000)).toBe(NOT_SUPPORTED);
    expect(uploadProblem("agreement", "application/pdf", 400_000)).toBeNull();
    expect(uploadProblem("id_proof", "image/png", MAX_UPLOAD_BYTES + 1)).toBe(TOO_LARGE);
    expect(uploadProblem("id_proof", "image/png", 0)).toBe(TOO_LARGE);
  });
  it("stores a plain file name", () => {
    expect(cleanFileName("C:\\Users\\me\\agreement.pdf")).toBe("agreement.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("\u0000")).toBe("file");
  });
});
