// P-01 and P-03 render from props alone. Checks the content rules the spec and decisions set:
// D-26 (QR carries no amount; optional elements omitted, not placeholders), D-01/D-02 (the door
// card carries the unit's door token, never a tenant token), D-19 (figures and words).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CARDS_PER_PAGE, DoorQrCards, doorLink } from "../src/app/print/door-qr/door-qr-cards";
import { doorQrFixture, receiptFixture, receiptFixtureMinimal } from "../src/app/print/fixtures";
import { Receipt } from "../src/app/print/receipt/receipt";
import { receiptUpiNote } from "../src/app/print/_lib/upi";
import { buildUpiLink, UPI_NOTE_MAX } from "../src/lib/upi";

function decode(html: string): string {
  return html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

describe("buildUpiLink (D-26, D-27)", () => {
  it("carries the UPI ID, the receipt name and the note, and no amount", () => {
    const link = buildUpiLink({ upiId: "anil.kulkarni@okdemo", payeeName: "Kulkarni Properties", note: receiptUpiNote("2A") });
    expect(link.startsWith("upi://pay?")).toBe(true);
    const params = new URLSearchParams(link.slice("upi://pay?".length));
    expect(params.get("pa")).toBe("anil.kulkarni@okdemo");
    expect(params.get("pn")).toBe("Kulkarni Properties");
    expect(params.get("tn")).toBe("Rent — Flat 2A");
    expect(params.has("am")).toBe(false);
  });
  it("caps the note at the UPI limit", () => {
    const link = buildUpiLink({ upiId: "a@b", payeeName: "x", note: "y".repeat(80) });
    expect(new URLSearchParams(link.split("?")[1]).get("tn")).toHaveLength(UPI_NOTE_MAX);
  });
});

describe("P-01 receipt", () => {
  const full = decode(renderToStaticMarkup(createElement(Receipt, { ...receiptFixture, autoPrint: false })));
  const minimal = decode(
    renderToStaticMarkup(createElement(Receipt, { ...receiptFixtureMinimal, autoPrint: false })),
  );

  it("prints every content item the spec lists", () => {
    expect(full).toContain("Kulkarni Properties"); // landlord receipt name
    expect(full).toContain(receiptFixture.landlord.logoUrl); // logo
    expect(full).toContain("RR-0847"); // receipt number
    expect(full).toContain("Meera Desai"); // tenant
    expect(full).toContain("2A, Kulkarni Apartments"); // unit
    expect(full).toContain("October 2026"); // month
    expect(full).toContain("₹18,000"); // amount in figures (D-19)
    expect(full).toContain("Rupees eighteen thousand only"); // amount in words (D-19)
    expect(full).toContain("05 Oct 2026"); // date received (A2 format)
    expect(full).toContain("UPI 428812345678"); // payment reference
    expect(full).toContain("<svg"); // payment QR
    expect(full).toContain("Signature"); // signature line
  });

  it("prints the landlord PAN when present", () => {
    expect(full).toContain("ABCDE1234F");
  });

  it("uses Indian grouping and words for a lakh amount", () => {
    expect(minimal).toContain("₹1,86,000");
    expect(minimal).not.toContain("186,000");
    expect(minimal).toContain("Rupees one lakh eighty-six thousand only");
  });

  it("omits logo, QR, PAN and reference when not saved, with no placeholder (D-26)", () => {
    expect(minimal).not.toContain("<img");
    expect(minimal).not.toContain("<svg");
    expect(minimal).not.toContain("UPI");
    expect(minimal).not.toContain("PAN");
    expect(minimal).not.toContain("Payment reference");
    expect(minimal).toContain("Anil Kulkarni");
    expect(minimal).toContain("RR-0003");
  });

  it("has no navigation, links or buttons", () => {
    for (const html of [full, minimal]) {
      expect(html).not.toMatch(/<nav|<button|<a /);
    }
  });

  it("never uses the words error, invalid, failed or unauthorised (E1)", () => {
    for (const html of [full, minimal]) {
      expect(html).not.toMatch(/error|invalid|failed|unauthorised/i);
    }
  });
});

describe("P-03 door QR cards", () => {
  const html = decode(renderToStaticMarkup(createElement(DoorQrCards, { ...doorQrFixture, autoPrint: false })));

  it("builds the T-01 door link from the door token (D-01, D-03)", () => {
    expect(doorLink("https://rentroll.example", "abc")).toBe("https://rentroll.example/u/abc");
    expect(doorLink("https://rentroll.example/", "abc")).toBe("https://rentroll.example/u/abc");
  });

  it("prints one card per unit with its own door token", () => {
    for (const unit of doorQrFixture.units) {
      expect(html).toContain(unit.unitNumber);
      expect(html).toContain(`report a problem in ${unit.unitNumber}, ${unit.propertyName}`);
    }
    expect(html.match(/<article/g)).toHaveLength(doorQrFixture.units.length);
    expect(html.match(/<svg/g)).toHaveLength(doorQrFixture.units.length);
  });

  it("only ever accepts a door token — the props carry no tenant token", () => {
    const keys = new Set(doorQrFixture.units.flatMap((u) => Object.keys(u)));
    expect(keys).toEqual(new Set(["unitNumber", "propertyName", "doorToken"]));
  });

  it("lays four cards to a page", () => {
    expect(CARDS_PER_PAGE).toBe(4);
    const pages = html.match(/<section class="print-page/g) ?? [];
    expect(pages).toHaveLength(Math.ceil(doorQrFixture.units.length / 4));
  });

  it("prints the instruction and the phone fallback", () => {
    expect(html).toContain("Scan to report a problem");
    expect(html).toContain("Can't scan? Call +91 90000 00001");
  });

  it("omits the phone line while the landlord has no phone (D-20)", () => {
    const noPhone = renderToStaticMarkup(
      createElement(DoorQrCards, { ...doorQrFixture, landlordPhone: null, autoPrint: false }),
    );
    expect(noPhone).not.toContain("Call");
  });

  it("carries no money, no tenant and no navigation", () => {
    expect(html).not.toMatch(/₹|rent|deposit|Meera/i);
    expect(html).not.toMatch(/<nav|<button|<a /);
  });
});

describe("buildUpiLink encoding", () => {
  it("encodes spaces as %20, never +", () => {
    const link = buildUpiLink({ upiId: "a@b", payeeName: "Kulkarni Properties", note: "Rent — Flat 2A" });
    expect(link).toContain("pn=Kulkarni%20Properties");
    expect(link).not.toContain("+");
  });
});
