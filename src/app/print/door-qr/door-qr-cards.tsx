// P-03 · Door QR card (print view). spec/screens/P-03.md, D-01, D-02, D-20.
//
// Contents per card: unit number · property name · the QR · "Scan to report a problem" ·
// the landlord's phone as a fallback (omitted while `landlord.phone` is empty, D-20).
// Sized four to an A4 page.
//
// The QR carries the unit's `door_token` — never a `tenant_token`. A door sticker outlives
// tenancies and reaches T-01/T-02 only (D-01, D-02); the tenant's personal link is shared
// from L-09, not printed on a door. Opened from L08-BTN-PRINTQR (one card per selected unit)
// and E2-03. Takes props; never queries.
import { formatPhone } from "@/lib/format";

import { PrintPage, PrintSheet } from "../_lib/print-sheet";
import { QrSvg } from "../_lib/qr-svg";

export const CARDS_PER_PAGE = 4;

export interface DoorQrCardProps {
  /** `unit.unit_number`. */
  unitNumber: string;
  /** `property.name`. */
  propertyName: string;
  /** `unit.door_token` (D-01). The only token that may be printed on a door. */
  doorToken: string;
}

export interface DoorQrCardsProps {
  /** Absolute base URL of this deployment, no trailing slash (APP_BASE_URL, D-03). */
  baseUrl: string;
  /** `landlord.phone`; the fallback line is omitted while empty (D-20). */
  landlordPhone?: string | null;
  units: DoorQrCardProps[];
  /** Trigger the print dialog on load (the P-03 rule). Default true. */
  autoPrint?: boolean;
}

/** The T-01 door link for a unit: `/u/:token` (D-01, D-03). */
export function doorLink(baseUrl: string, doorToken: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/u/${encodeURIComponent(doorToken)}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

export function DoorQrCards({ baseUrl, landlordPhone, units, autoPrint = true }: DoorQrCardsProps) {
  const phone = landlordPhone?.trim() ? formatPhone(landlordPhone) : null;
  return (
    <PrintSheet autoPrint={autoPrint}>
      {chunk(units, CARDS_PER_PAGE).map((page, index) => (
        <PrintPage key={index} className="door-grid">
          {page.map((unit) => (
            <DoorQrCard key={unit.doorToken} unit={unit} href={doorLink(baseUrl, unit.doorToken)} phone={phone} />
          ))}
        </PrintPage>
      ))}
    </PrintSheet>
  );
}

function DoorQrCard({ unit, href, phone }: { unit: DoorQrCardProps; href: string; phone: string | null }) {
  return (
    <article className="flex flex-col items-center justify-between gap-4 border border-dashed border-line p-6 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-h2 text-body">{unit.propertyName}</p>
        <p className="text-display text-ink">{unit.unitNumber}</p>
      </div>
      <QrSvg value={href} sizeMm={58} label={`QR code: report a problem in ${unit.unitNumber}, ${unit.propertyName}`} />
      <div className="flex flex-col gap-1">
        <p className="text-h2 text-ink">Scan to report a problem</p>
        {phone && <p className="text-small text-muted">Can&apos;t scan? Call {phone}</p>}
      </div>
    </article>
  );
}
