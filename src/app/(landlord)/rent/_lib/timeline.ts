// L05-TML-REMINDERS (D-14, D-17, D-38): the rent entry's confirmed messages and logged calls,
// plus its amount-edit audit events. Payments are listed in L05-SEC-AMOUNT, not here.
import type { TimelineEvent } from "@/components/ui";
import { formatRupees } from "@/lib/format";

export interface ReminderMessage {
  id: string;
  kind: "rent_reminder" | "call" | "payment_link";
  channel: "whatsapp" | "copy" | "email" | "call";
  level: number | null;
  callOutcome: string | null;
  callNote: string | null;
  confirmedAt: string;
}

export interface ReminderAudit {
  id: string;
  kind: string;
  oldValue: unknown;
  newValue: unknown;
  note: string | null;
  createdAt: string;
}

/** L05-FRM-LOGCALL outcome dropdown, in the spec's order. Stored in `message.call_outcome`. */
export const CALL_OUTCOMES = [
  { value: "promised_to_pay", label: "Promised to pay" },
  { value: "no_answer", label: "No answer" },
  { value: "disputed", label: "Disputed" },
  { value: "other", label: "Other" },
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number]["value"];

export function isCallOutcome(value: string): value is CallOutcome {
  return CALL_OUTCOMES.some((o) => o.value === value);
}

/** D-38: level 1 gentle, 2 direct, 3 formal. */
const LEVEL_NAMES: Record<number, string> = { 1: "Gentle", 2: "Direct", 3: "Formal" };

const SENT_BY: Record<ReminderMessage["channel"], string> = {
  whatsapp: "sent by WhatsApp",
  email: "sent by email",
  copy: "copied and sent",
  call: "by call",
};

function messageText(message: ReminderMessage): string {
  if (message.kind === "call") {
    const outcome = CALL_OUTCOMES.find((o) => o.value === message.callOutcome)?.label.toLowerCase() ?? "logged";
    return message.callNote ? `Call — ${outcome}. ${message.callNote}` : `Call — ${outcome}`;
  }
  if (message.kind === "payment_link") return `Payment link ${SENT_BY[message.channel]}`;
  const level = LEVEL_NAMES[message.level ?? 0] ?? "Rent";
  return `${level} reminder ${SENT_BY[message.channel]}`;
}

function amountOf(value: unknown): number | null {
  const amount = (value as { amount_due?: unknown } | null)?.amount_due;
  return typeof amount === "number" ? amount : null;
}

export function buildReminderTimeline(messages: ReminderMessage[], audits: ReminderAudit[]): TimelineEvent[] {
  const events: TimelineEvent[] = messages.map((m) => ({
    id: `message-${m.id}`,
    icon: m.kind === "call" ? "call" : "bell",
    text: messageText(m),
    at: m.confirmedAt,
    tone: m.kind === "rent_reminder" && m.level === 3 ? "danger" : "body",
  }));
  for (const audit of audits) {
    if (audit.kind !== "amount_edit") continue;
    const from = amountOf(audit.oldValue);
    const to = amountOf(audit.newValue);
    if (from === null || to === null) continue;
    events.push({
      id: `audit-${audit.id}`,
      icon: "rupee",
      text: `Amount changed from ${formatRupees(from)} to ${formatRupees(to)}`,
      at: audit.createdAt,
    });
  }
  return events;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One line above the timeline: reminders sent and calls logged both count toward the history. */
export function reminderHistorySummary(messages: Pick<ReminderMessage, "kind">[]): string {
  const reminders = messages.filter((m) => m.kind === "rent_reminder").length;
  const calls = messages.filter((m) => m.kind === "call").length;
  if (reminders === 0 && calls === 0) return "No reminders or calls yet.";
  return `${plural(reminders, "reminder sent", "reminders sent")} · ${plural(calls, "call logged", "calls logged")}`;
}
