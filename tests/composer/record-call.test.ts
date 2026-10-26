// L05-FRM-LOGCALL through recordCall (D-17 kind `call`): the export other lanes may use. It
// validates its own input, because its callers are server functions reachable by direct POST.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const insert = vi.fn();
const createClient = vi.fn();
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: () => createClient() }));

import { recordCall } from "@/server/composer/record";

const ENTRY = "7d3c8f8e-2f4b-4d8e-9a0e-0d6c1c3b5a11";

function fakeSupabase(entryVisible = true) {
  const single = (data: unknown) => ({ maybeSingle: async () => ({ data, error: null }) });
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) =>
      table === "landlord"
        ? { select: () => single({ id: "landlord-1" }) }
        : table === "rent_entry"
          ? { select: () => ({ eq: () => single(entryVisible ? { id: ENTRY, tenancy_id: "tenancy-1" } : null) }) }
          : { insert: async (row: unknown) => (insert(row), { error: null }) },
  };
}

beforeEach(() => {
  insert.mockReset();
  createClient.mockReset();
  createClient.mockResolvedValue(fakeSupabase());
});

describe("recordCall", () => {
  it("writes one call row with no body, channel or level of its own", async () => {
    await expect(recordCall({ rentEntryId: ENTRY, outcome: "promised_to_pay", note: "  Will pay Friday  " })).resolves.toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      landlord_id: "landlord-1",
      kind: "call",
      channel: "call",
      rent_entry_id: ENTRY,
      tenancy_id: "tenancy-1",
      call_outcome: "promised_to_pay",
      call_note: "Will pay Friday",
    });
  });

  it("stores an empty note as null", async () => {
    await recordCall({ rentEntryId: ENTRY, outcome: "no_answer", note: "   " });
    expect(insert.mock.calls[0][0].call_note).toBeNull();
  });

  it("rejects bad input before touching the database", async () => {
    const bad = [
      { rentEntryId: "not-a-uuid", outcome: "no_answer", note: null },
      { rentEntryId: ENTRY, outcome: "sent_reminder", note: null },
      { rentEntryId: ENTRY, outcome: "other", note: "x".repeat(501) },
      { rentEntryId: ENTRY, outcome: "other", note: 42 },
    ];
    for (const input of bad) {
      // @ts-expect-error — direct POST can send anything
      await expect(recordCall(input)).resolves.toEqual({ ok: false });
    }
    expect(createClient).not.toHaveBeenCalled();
  });

  it("writes nothing for an entry RLS hides (another landlord's, E4-5)", async () => {
    createClient.mockResolvedValue(fakeSupabase(false));
    await expect(recordCall({ rentEntryId: ENTRY, outcome: "disputed", note: null })).resolves.toEqual({ ok: false });
    expect(insert).not.toHaveBeenCalled();
  });
});
