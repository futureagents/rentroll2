// L05-TML-REMINDERS (D-14, D-17, D-38): the rent entry's confirmed messages and logged calls,
// plus its amount-edit audit events.
import { describe, expect, it } from "vitest";

import {
  CALL_OUTCOMES,
  buildReminderTimeline,
  reminderHistorySummary,
  type ReminderAudit,
  type ReminderMessage,
} from "@/app/(landlord)/rent/_lib/timeline";

const reminder = (over: Partial<ReminderMessage>): ReminderMessage => ({
  id: "m1",
  kind: "rent_reminder",
  channel: "whatsapp",
  level: 1,
  callOutcome: null,
  callNote: null,
  confirmedAt: "2026-10-08T05:00:00Z",
  ...over,
});

describe("L05-TML-REMINDERS", () => {
  it("shows each reminder's level, method and time", () => {
    const events = buildReminderTimeline(
      [
        reminder({ id: "m1", level: 1, channel: "whatsapp" }),
        reminder({ id: "m2", level: 2, channel: "email", confirmedAt: "2026-10-15T05:00:00Z" }),
        reminder({ id: "m3", level: 3, channel: "copy", confirmedAt: "2026-10-25T05:00:00Z" }),
      ],
      [],
    );
    expect(events.map((e) => e.text)).toEqual([
      "Gentle reminder sent by WhatsApp",
      "Direct reminder sent by email",
      "Formal reminder copied and sent",
    ]);
    expect(events[0]).toMatchObject({ id: "message-m1", icon: "bell", at: "2026-10-08T05:00:00Z" });
  });

  it("includes logged calls with their outcome and note (D-17 kind call)", () => {
    const [event] = buildReminderTimeline(
      [reminder({ id: "c1", kind: "call", channel: "call", level: null, callOutcome: "promised_to_pay", callNote: "Will pay Friday" })],
      [],
    );
    expect(event).toMatchObject({ id: "message-c1", icon: "call", text: "Call — promised to pay. Will pay Friday" });
  });

  it("shows a call with no note", () => {
    const [event] = buildReminderTimeline(
      [reminder({ kind: "call", channel: "call", level: null, callOutcome: "no_answer", callNote: null })],
      [],
    );
    expect(event.text).toBe("Call — no answer");
  });

  it("includes payment links sent for this month", () => {
    const [event] = buildReminderTimeline([reminder({ kind: "payment_link", level: null })], []);
    expect(event.text).toBe("Payment link sent by WhatsApp");
  });

  it("records an amount edit with the old and new value (L05-BTN-EDIT, D-25)", () => {
    const audit: ReminderAudit = {
      id: "a1",
      kind: "amount_edit",
      oldValue: { amount_due: 10_000 },
      newValue: { amount_due: 6_333 },
      note: null,
      createdAt: "2026-10-02T06:00:00Z",
    };
    const [event] = buildReminderTimeline([], [audit]);
    expect(event).toMatchObject({ id: "audit-a1", icon: "rupee", text: "Amount changed from ₹10,000 to ₹6,333" });
  });

  it("leaves out audit kinds that are not part of the reminder history", () => {
    const audit: ReminderAudit = {
      id: "a2",
      kind: "payment_recorded",
      oldValue: null,
      newValue: { amount: 8_000 },
      note: null,
      createdAt: "2026-10-02T06:00:00Z",
    };
    expect(buildReminderTimeline([], [audit])).toEqual([]);
  });

  it("offers exactly the four L05-FRM-LOGCALL outcomes", () => {
    expect(CALL_OUTCOMES.map((o) => o.label)).toEqual(["Promised to pay", "No answer", "Disputed", "Other"]);
  });
});

describe("reminder history counts calls alongside reminders", () => {
  it("counts confirmed reminders and logged calls separately", () => {
    const summary = reminderHistorySummary([
      reminder({ id: "1" }),
      reminder({ id: "2", level: 2 }),
      reminder({ id: "3", kind: "call", channel: "call", level: null, callOutcome: "promised_to_pay" }),
      reminder({ id: "4", kind: "payment_link", level: null }),
    ]);
    expect(summary).toBe("2 reminders sent · 1 call logged");
  });

  it("says nothing has happened when the history is empty", () => {
    expect(reminderHistorySummary([])).toBe("No reminders or calls yet.");
  });

  it("uses singular forms", () => {
    expect(
      reminderHistorySummary([reminder({ id: "1" }), reminder({ id: "2", kind: "call", channel: "call", level: null, callOutcome: "other" })]),
    ).toBe("1 reminder sent · 1 call logged");
  });
});
