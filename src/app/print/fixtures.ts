// Props fixtures for the print views, drawn from the demo seed (scripts/seed/data.mjs):
// Anil Kulkarni's "Kulkarni Properties", flat 2A let to Meera Desai. Used by the dev preview
// routes and the tests. Phones, UPI handle, PAN and tokens are fictitious.
import type { DoorQrCardsProps } from "./door-qr/door-qr-cards";
import type { ReceiptProps } from "./receipt/receipt";

// A small inline monogram standing in for L15-UPL-LOGO.
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="midnightblue"/><text x="32" y="41" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="600" fill="white">KP</text></svg>';
export const LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

/** Everything present: logo, PAN, UPI QR, payment reference. */
export const receiptFixture: ReceiptProps = {
  receiptNumber: "RR-0847",
  tenantName: "Meera Desai",
  unitNumber: "2A",
  propertyName: "Kulkarni Apartments",
  month: "2026-10",
  amount: 18000,
  receivedOn: "2026-10-05",
  reference: "UPI 428812345678",
  landlord: {
    receiptName: "Kulkarni Properties",
    logoUrl: LOGO_DATA_URL,
    upiId: "anil.kulkarni@okdemo",
    pan: "ABCDE1234F",
  },
};

/** Nothing optional saved: no logo, no UPI ID (so no QR), no PAN, no reference (D-26). */
export const receiptFixtureMinimal: ReceiptProps = {
  receiptNumber: "RR-0003",
  tenantName: "Suresh Khan",
  unitNumber: "G1",
  propertyName: "Shanti Niwas",
  month: "2026-09",
  amount: 186000,
  receivedOn: "2026-09-01",
  landlord: {
    receiptName: "Anil Kulkarni",
  },
};

/** Five units: a full page of four and a second page with one card. */
export const doorQrFixture: DoorQrCardsProps = {
  baseUrl: "https://rentroll.example",
  landlordPhone: "+919000000001",
  units: [
    { unitNumber: "1A", propertyName: "Kulkarni Apartments", doorToken: "d7Qf3kLm9XpR2vWz8sTn4bHc" },
    { unitNumber: "1B", propertyName: "Kulkarni Apartments", doorToken: "aK2pM8vN4xQ7rT1wY6zB3cDe" },
    { unitNumber: "2A", propertyName: "Kulkarni Apartments", doorToken: "hG5sJ9kL2mN7pQ4rS8tV1wXy" },
    { unitNumber: "2B", propertyName: "Kulkarni Apartments", doorToken: "zC3vB6nM9kL2jH5gF8dS1aPo" },
    { unitNumber: "G1", propertyName: "Shanti Niwas", doorToken: "qW4eR7tY1uI8oP2aS5dF9gHj" },
  ],
};
