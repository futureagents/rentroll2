// L07-TML-HISTORY (D-14): audit events plus confirmed messages. A reopen is a status_change with
// `reopened: true`, so the landlord sees "Reopened" and T-03 (which reads status_change rows
// only, D-30) can too — it is a timeline entry, never a new request.
import { describe, expect, it } from "vitest";

import { requestHistory, type AuditRow } from "../../src/app/(landlord)/maintenance/_lib/history";

const audit = (kind: string, values: Partial<AuditRow> = {}): AuditRow => ({
  id: kind,
  kind,
  old_value: null,
  new_value: null,
  note: null,
  created_at: "2026-10-20T10:00:00Z",
  ...values,
});

describe("requestHistory", () => {
  it("synthesises the Reported line for tenant reports, which carry no created event", () => {
    const events = requestHistory({ created_at: "2026-10-18T09:00:00Z", reported_via: "tenant_link" }, [], []);
    expect(events).toEqual([{ id: "reported", icon: "plus", text: "Reported by the tenant", at: "2026-10-18T09:00:00Z" }]);
  });

  it("uses the created event for landlord-logged requests instead of synthesising one", () => {
    const events = requestHistory({ created_at: "2026-10-18T09:00:00Z", reported_via: "phone" }, [
      audit("created", { new_value: { reported_via: "phone" } }),
    ], []);
    expect(events.map((e) => e.text)).toEqual(["Logged — phone call"]);
  });

  it("words status changes, reopens, cost and notes", () => {
    const texts = requestHistory({ created_at: "2026-10-18T09:00:00Z", reported_via: "tenant_link" }, [
      audit("status_change", { id: "1", old_value: { status: "new" }, new_value: { status: "in_progress" } }),
      audit("cost_recorded", { id: "2", new_value: { cost: 186000, no_cost: false } }),
      audit("status_change", { id: "3", new_value: { status: "done" } }),
      audit("status_change", { id: "4", old_value: { status: "done" }, new_value: { status: "assigned", reopened: true } }),
      audit("cost_recorded", { id: "5", new_value: { cost: null, no_cost: true } }),
      audit("note", { id: "6", note: "Called twice" }),
    ], []).map((e) => e.text);
    expect(texts).toEqual([
      "Reported by the tenant",
      "Moved to In progress",
      "Cost recorded: ₹1,86,000",
      "Moved to Done",
      "Reopened — back to Assigned",
      "Recorded as no cost",
      "Note: Called twice",
    ]);
  });

  it("adds confirmed messages and skips kinds it does not know", () => {
    const texts = requestHistory({ created_at: "2026-10-18T09:00:00Z", reported_via: "tenant_link" }, [audit("mystery")], [
      { id: "m1", kind: "vendor_dispatch", channel: "whatsapp", confirmed_at: "2026-10-19T09:00:00Z", vendor_name: "Ramesh Electricals" },
      { id: "m2", kind: "tenant_update", channel: "copy", confirmed_at: "2026-10-19T10:00:00Z", vendor_name: null },
      { id: "m3", kind: "rent_reminder", channel: "whatsapp", confirmed_at: "2026-10-19T11:00:00Z", vendor_name: null },
    ]).map((e) => e.text);
    expect(texts).toEqual(["Reported by the tenant", "Job sent to Ramesh Electricals (WhatsApp)", "Tenant updated (copied)"]);
  });
});
