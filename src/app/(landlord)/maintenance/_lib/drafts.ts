// L-07 · template drafts for the three messages it opens S-01 with (D-17 kinds
// vendor_dispatch, tenant_update, payment_link). D-37: each kind has a fixed template used
// when the assistant does not answer; the assistant receives the same fields and no more.
// These are text only: handing a message to WhatsApp and recording it are S-01's alone.
//
// G-2 / L-07 rule / D-27 / D-37: a system-written tenant update is built from status and
// category only — never cost, vendor, or vendor rate. The input type names exactly those two
// fields and the function reads nothing else, so a caller cannot leak a cost into the draft by
// passing a wider object.
import { formatPhone, formatRupees } from "@/lib/format";

import { CATEGORY_LABEL, type Category, type RequestStatus } from "./model";

/** D-37: the only input a tenant update draft may use. */
export interface TenantUpdateInput {
  status: RequestStatus;
  category: Category;
}

const TENANT_STATUS_LINE: Record<RequestStatus, string> = {
  new: "we have received it and will arrange the repair.",
  assigned: "someone has been arranged to fix it and will be in touch.",
  in_progress: "the work is in progress.",
  done: "the work is done. Please tell us if anything is still not right.",
};

/** L07-BTN-UPDATETENANT: "The draft never mentions cost or vendor rates." */
export function tenantUpdateDraft(input: TenantUpdateInput): string {
  const { status, category } = input;
  const problem = category === "other" ? "the problem" : `the ${CATEGORY_LABEL[category].toLowerCase()} problem`;
  return `Hello, an update on ${problem} you reported: ${TENANT_STATUS_LINE[status]}`;
}

/** D-34: "Flat 2A, Kulkarni Apartments, <address>". */
export function dispatchAddress(unitNumber: string, propertyName: string, propertyAddress: string): string {
  return [`Flat ${unitNumber}`, propertyName, propertyAddress].map((part) => part.trim()).filter(Boolean).join(", ");
}

/** D-34: the Maps link uses the property address. */
export function mapsLink(propertyName: string, propertyAddress: string): string {
  const query = [propertyName, propertyAddress].map((part) => part.trim()).filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** D-37: dispatch receives the vendor's first name, the problem, the address and the tenant's phone. */
export interface VendorDispatchInput {
  vendorName: string;
  category: Category;
  description: string;
  unitNumber: string;
  propertyName: string;
  propertyAddress: string;
  /** `+91XXXXXXXXXX`, or null for a vacant unit. */
  tenantPhone: string | null;
  tenantName: string | null;
}

/**
 * L07-BTN-DISPATCH: "a vendor-flavoured draft containing: the problem, the unit's address,
 * the tenant's phone and a Maps link."
 */
export function vendorDispatchDraft(input: VendorDispatchInput): string {
  const firstName = input.vendorName.trim().split(/\s+/)[0] ?? "";
  const lines = [
    `Hello ${firstName}, there is a ${CATEGORY_LABEL[input.category].toLowerCase()} job for you.`,
    "",
    `Problem: ${input.description.trim()}`,
    `Address: ${dispatchAddress(input.unitNumber, input.propertyName, input.propertyAddress)}`,
  ];
  if (input.tenantPhone) {
    const who = input.tenantName?.trim() ? `${input.tenantName.trim()}, ` : "";
    lines.push(`Tenant: ${who}${formatPhone(input.tenantPhone)}`);
  }
  lines.push(`Map: ${mapsLink(input.propertyName, input.propertyAddress)}`, "", "Please let me know when you can come.");
  return lines.join("\n");
}

/** The common UPI note limit (D-27). */
export const UPI_NOTE_MAX = 50;

/** D-27: for a tenant-liable repair, S02-FLD-NOTE defaults to "Repair — <category> — Flat 2A". */
export function repairPaymentNote(category: Category, unitNumber: string): string {
  return capNote(`Repair — ${CATEGORY_LABEL[category]} — Flat ${unitNumber}`);
}

export function capNote(note: string): string {
  return Array.from(note.trim()).slice(0, UPI_NOTE_MAX).join("");
}

export interface PaymentLinkInput {
  upiId: string;
  payeeName: string;
  /** Whole rupees, as set by the landlord in the payment sheet. */
  amount: number;
  note: string;
}

/**
 * D-27: "The payment link is a plain UPI intent URL (`upi://pay?pa=…&pn=…&am=…&tn=…`); there is
 * no hosted RentRoll payment page in v1, so no tenant-facing screen shows the figure."
 * PROMOTE: payment link builder — belongs with S-02 (and the P-01 builder in
 * src/app/print/_lib/upi.ts, which has no amount) once the S-02 lane lands.
 */
export function buildPaymentLink({ upiId, payeeName, amount, note }: PaymentLinkInput): string {
  // encodeURIComponent, not URLSearchParams: spaces must be %20, not "+" (as P-01 does).
  const params: [string, string][] = [
    ["pa", upiId.trim()],
    ["pn", payeeName.trim()],
    ["am", String(Math.round(amount))],
    ["tn", capNote(note)],
    ["cu", "INR"],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/**
 * The S02-BTN-SENDLINK draft. D-27: a message the landlord reads and sends may state the amount
 * the landlord is asking the tenant to pay; the amount is the one the landlord set in the sheet.
 */
export function paymentRequestDraft(category: Category, amount: number, link: string): string {
  const what = category === "other" ? "the repair" : `the ${CATEGORY_LABEL[category].toLowerCase()} repair`;
  return `Hello, here is the payment request for ${what}: ${formatRupees(amount)}.\nYou can pay with this link: ${link}`;
}
