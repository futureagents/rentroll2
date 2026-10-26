// The L-09 view model: what the server page hands the client screen. Built in page.tsx from the
// landlord's own rows (RLS); file links are short-lived signed URLs made on the server (D-15).
import type { ChipTone } from "@/components/ui";

import type { Figures } from "../_lib/history";
import type { UnitOccupancy } from "../_lib/occupancy";

export interface PhotoView {
  id: string;
  src: string;
  alt: string;
}

export interface UnitView {
  id: string;
  unitNumber: string;
  label: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  type: string | null;
  /** Asking figures on the unit (D-23). */
  askingRent: number;
  askingDeposit: number;
  /** D-23: the current agreement's rent when occupied, otherwise the asking rent. */
  rent: number;
  occupancy: UnitOccupancy;
  current: {
    tenancyId: string;
    name: string;
    phone: string;
    movedInOn: string;
    agreementEndsOn: string | null;
    depositPaid: number;
    noticeVacateOn: string | null;
    /** `/u/<tenant_token>` (D-01). Copied and shared from L-09 only. Null without a configured base URL. */
    tenantLink: string | null;
    moveInPhotoCount: number;
  } | null;
  /** `/u/<door_token>`: report-only (D-02), shown as the QR. Null without a configured base URL. */
  doorLink: string | null;
  /** Why the token links are missing, when they are. */
  linkProblem: string | null;
  figures: { lifetime: Figures; lastTwelveMonths: Figures };
  /** The first move-in date ever, for "since …". */
  historySince: string | null;
  rentRows: {
    id: string;
    month: string;
    tenantName: string;
    amountDue: number;
    paid: number;
    isProRata: boolean;
    chip: { tone: ChipTone; label: string; sub: string | null };
  }[];
  requests: {
    id: string;
    number: string;
    reportedOn: string;
    category: string;
    status: { tone: ChipTone; label: string };
    cost: number | null;
    noCost: boolean;
    done: boolean;
    description: string;
  }[];
  repeatNotes: string[];
  moveIn: {
    tenancyId: string;
    tenantName: string;
    movedInOn: string;
    endedOn: string | null;
    active: boolean;
    photos: PhotoView[];
  }[];
  repairs: { requestId: string; number: string; photos: (PhotoView & { after: boolean })[] }[];
  documents: { id: string; typeLabel: string; fileName: string; tenantName: string | null; uploadedOn: string; url: string | null }[];
  /** D-39: delete only without tenancy history (and, here, without repair history). */
  canDelete: boolean;
  siblings: { id: string; propertyId: string; unitNumber: string }[];
  /** Default form values for L09-FRM-ADDTENANT. */
  today: string;
}
