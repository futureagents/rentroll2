// Shapes the rent server module hands to the L-04 board and L-05 panel. Client-safe, so client
// components never import from src/server (scripts/check-boundaries.mjs).
import type { IsoDate, MonthKey } from "./calendar";
import type { ReminderAudit, ReminderMessage } from "./timeline";

export interface BoardPayment {
  id: string;
  amount: number;
  receivedOn: IsoDate;
  reference: string | null;
  receiptNumber: string;
  status: "recorded" | "voided";
  createdAt: string;
}

export interface BoardEntry {
  id: string;
  month: MonthKey;
  amountDue: number;
  dueOn: IsoDate;
  isProRata: boolean;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  tenantPhone: string;
  payments: BoardPayment[];
}

export interface RentBoardData {
  month: MonthKey;
  entries: BoardEntry[];
  properties: { id: string; name: string }[];
  hasUnits: boolean;
}

export interface RentEntryDetail extends BoardEntry {
  messages: ReminderMessage[];
  audits: ReminderAudit[];
}
