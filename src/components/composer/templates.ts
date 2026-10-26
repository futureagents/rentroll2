// S-01 · Template drafts. S-01a drafts from these; S-01b falls back to them when the assistant
// does not answer within 4 seconds (E3, E1-09). Rent wording follows product.md §10 and D-38:
// Gentle is a nudge, Direct states the amount and the date, Formal refers to "our agreement
// dated <starts_on>" (no clause text is stored, so nothing is quoted).
import { formatDate, formatMonth, formatRupees } from "@/lib/format";

import type { Tone } from "./ladder";
import type { RentReminderContext } from "./types";

/** How many wordings each tone has; S01-BTN-REGENERATE cycles through them. */
export const TEMPLATE_VARIANTS = 2;

type Fields = Pick<
  RentReminderContext,
  | "recipient"
  | "unitLabel"
  | "month"
  | "dueOn"
  | "daysOverdue"
  | "amountDue"
  | "balance"
  | "agreementStartsOn"
  | "signOff"
>;

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "was due on 05 Oct 2026", "is due today", "is due on 05 Nov 2026". */
function dueClause(fields: Fields): string {
  if (fields.daysOverdue > 0) return `was due on ${formatDate(fields.dueOn)}`;
  if (fields.daysOverdue === 0) return "is due today";
  return `is due on ${formatDate(fields.dueOn)}`;
}

/** "₹18,000", or "the remaining ₹4,000" when part has been paid (D-10). */
function amountPhrase(fields: Fields): string {
  return fields.balance < fields.amountDue
    ? `the remaining ${formatRupees(fields.balance)}`
    : formatRupees(fields.balance);
}

export function rentReminderTemplate(fields: Fields, tone: Tone, variant = 0): string {
  const first = fields.recipient.firstName;
  const month = formatMonth(fields.month);
  const unit = fields.unitLabel;
  const due = dueClause(fields);
  const amount = amountPhrase(fields);
  const late = fields.daysOverdue > 0 ? ` and is now ${plural(fields.daysOverdue, "day")} overdue` : "";
  const sign = fields.signOff;
  const pick = ((variant % TEMPLATE_VARIANTS) + TEMPLATE_VARIANTS) % TEMPLATE_VARIANTS;

  if (tone === "gentle") {
    return pick === 0
      ? `Hi ${first}, a friendly reminder that the rent for ${month} for ${unit} ${due}. Please send it when you get a chance. Thank you!\n\n— ${sign}`
      : `Hello ${first}, hope you are well. Just a note that the ${month} rent for ${unit} ${due}. Could you please pay it when convenient? Thanks!\n\n— ${sign}`;
  }

  if (tone === "direct") {
    return pick === 0
      ? `Hi ${first}, the rent of ${amount} for ${month} for ${unit} ${due}${late}. Please pay it as soon as possible.\n\n— ${sign}`
      : `${first}, this is a reminder that ${amount} is outstanding for ${unit}: rent for ${month}, which ${due}. Please make the payment today.\n\n— ${sign}`;
  }

  const agreement = formatDate(fields.agreementStartsOn);
  return pick === 0
    ? `Dear ${fields.recipient.name},\n\nThis is a formal notice that the rent of ${amount} for ${unit} for ${month}, payable under our agreement dated ${agreement}, ${due}${late} and remains unpaid. Please pay the full amount at the earliest.\n\nRegards,\n${sign}`
    : `Dear ${fields.recipient.name},\n\nUnder our agreement dated ${agreement}, the rent for ${unit} for ${month} ${due}. ${capitalise(amount)} is still unpaid${fields.daysOverdue > 0 ? ` after ${plural(fields.daysOverdue, "day")}` : ""}. Please clear this amount without further delay.\n\nRegards,\n${sign}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
