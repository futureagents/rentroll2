// The L-11 view model, built in page.tsx from the landlord's own rows (RLS). `:tenantId` is a
// tenancy id (D-07).
import type { ChipTone } from "@/components/ui";

import type { TenancyStanding } from "../../units/_lib/occupancy";

export interface TermView {
  id: string;
  startsOn: string;
  endsOn: string;
  rent: number;
  rentDueDay: number;
}

export interface TenantView {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  unitId: string;
  unitLabel: string;
  active: boolean;
  standing: TenancyStanding;
  movedInOn: string;
  endedOn: string | null;
  depositPaid: number;
  depositReceivedOn: string | null;
  noticeGivenOn: string | null;
  noticeVacateOn: string | null;
  current: TermView | null;
  earlier: TermView[];
  upcoming: TermView[];
  countdown: { tone: ChipTone; label: string } | null;
  onTime: { onTime: number; counted: number; percent: number | null };
  payments: {
    id: string;
    month: string;
    dueOn: string;
    amountDue: number;
    paid: number;
    isProRata: boolean;
    receipts: { number: string; receivedOn: string; amount: number }[];
    chip: { tone: ChipTone; label: string; sub: string | null };
  }[];
  documents: { id: string; typeLabel: string; fileName: string; uploadedOn: string; url: string | null }[];
  today: string;
}
