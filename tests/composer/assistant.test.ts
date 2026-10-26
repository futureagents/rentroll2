// S-01b · Assistant drafting: the 4-second ceiling (E3, E1-09), the D-37 input contract, and the
// checks that send an unusable answer to the template instead.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/composer/actions", () => ({ draftMessage: vi.fn() }));

import { DRAFT_CEILING_MS, requestDraft } from "@/components/composer/draft";
import type { RentReminderContext } from "@/components/composer/types";
import { acceptDraft, rentReminderFacts } from "@/server/composer/assistant";

const context: RentReminderContext = {
  kind: "rent_reminder",
  rentEntryId: "7d3c8f8e-2f4b-4d8e-9a0e-0d6c1c3b5a11",
  recipient: { name: "Suresh Khan", firstName: "Suresh", phone: "+919876543210", email: "suresh@example.com" },
  unitLabel: "Flat 4C · Kulkarni Apartments",
  month: "2026-10-01",
  dueOn: "2026-10-05",
  daysOverdue: 21,
  amountDue: 18000,
  balance: 18000,
  ladderDays: [3, 10, 20],
  remindersSent: 2,
  callsLogged: 0,
  preselectedLevel: 3,
  agreementStartsOn: "2025-04-01",
  signOff: "Anita Kulkarni",
  payLink: null,
  staleNote: null,
};

describe("requestDraft — the composer is never blocked by the assistant", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses the assistant's draft when it arrives in time", async () => {
    const assistant = vi.fn().mockResolvedValue({ text: "Assistant wording" });
    await expect(requestDraft(context, "direct", 0, assistant)).resolves.toEqual({
      text: "Assistant wording",
      source: "assistant",
    });
    expect(assistant).toHaveBeenCalledWith({ rentEntryId: context.rentEntryId, tone: "direct", variant: 0 });
  });

  it("falls back to the template when the assistant declines or fails", async () => {
    const declined = await requestDraft(context, "gentle", 0, vi.fn().mockResolvedValue({ text: null }));
    expect(declined.source).toBe("template");
    expect(declined.text).toContain("Hi Suresh");
    const failed = await requestDraft(context, "gentle", 0, vi.fn().mockRejectedValue(new Error("network")));
    expect(failed.source).toBe("template");
  });

  it("falls back to the template at the 4-second ceiling and ignores a late answer", async () => {
    let answer: (value: { text: string }) => void = () => undefined;
    const slow = vi.fn(() => new Promise<{ text: string | null }>((resolve) => (answer = resolve)));
    const pending = requestDraft(context, "formal", 0, slow);
    await vi.advanceTimersByTimeAsync(DRAFT_CEILING_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const draft = await pending;
    expect(draft.source).toBe("template");
    answer({ text: "Too late" });
    await expect(pending).resolves.toEqual(draft);
  });

  it("uses a 4-second ceiling (E3)", () => {
    expect(DRAFT_CEILING_MS).toBe(4000);
  });
});

describe("D-37 rent-reminder input contract", () => {
  it("sends only first name, unit label, month, dates and amounts", () => {
    const facts = rentReminderFacts(context);
    expect(Object.keys(facts).sort()).toEqual(
      ["agreement_date", "amount_outstanding", "days_overdue", "due_date", "part_paid", "rent_month", "tenant_first_name", "unit"].sort(),
    );
    const serialised = JSON.stringify(facts);
    expect(serialised).not.toContain("9876543210");
    expect(serialised).not.toContain("suresh@example.com");
    expect(serialised).not.toContain("Khan");
    expect(serialised).not.toContain("Anita");
    expect(facts.amount_outstanding).toBe("₹18,000");
    expect(facts.due_date).toBe("05 Oct 2026");
  });
});

describe("acceptDraft", () => {
  it("requires the amount and due date for Direct and Formal, and the agreement date for Formal", () => {
    const direct = "Hi Suresh, ₹18,000 for October was due on 05 Oct 2026. Please pay today.";
    expect(acceptDraft(direct, "direct", context)).toBe(direct);
    expect(acceptDraft("Hi Suresh, please pay the rent soon.", "direct", context)).toBeNull();
    expect(acceptDraft(direct, "formal", context)).toBeNull();
    const formal = `${direct} This is under our agreement dated 01 Apr 2025.`;
    expect(acceptDraft(formal, "formal", context)).toBe(formal);
  });

  it("rejects invented figures: none for Gentle, only the outstanding amount otherwise", () => {
    expect(acceptDraft("Hi Suresh, the ₹18,000 rent is due.", "gentle", context)).toBeNull();
    const extra = "Hi Suresh, ₹18,000 was due on 05 Oct 2026, plus a ₹500 late fee.";
    expect(acceptDraft(extra, "direct", context)).toBeNull();
  });

  it("rejects empty, overlong, placeholder and markdown answers", () => {
    expect(acceptDraft("   ", "gentle", context)).toBeNull();
    expect(acceptDraft("x".repeat(1201), "gentle", context)).toBeNull();
    expect(acceptDraft("Hi [Tenant name], rent is due.", "gentle", context)).toBeNull();
    expect(acceptDraft("Hi {first_name}", "gentle", context)).toBeNull();
    expect(acceptDraft("**Reminder** Hi Suresh", "gentle", context)).toBeNull();
    expect(acceptDraft("Hi Suresh, a friendly nudge about October's rent.", "gentle", context)).not.toBeNull();
  });
});
