// T01-BTN-SUBMIT's server action: it sets the T-02 confirmation cookie only when the tenant
// server hands one back (door-token reports), HttpOnly and scoped to this link's T-02 path, and
// never returns the confirmation to client code (D-02).
import { beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.fn();
const submitTenantReport = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
vi.mock("@/server/tenant", () => ({
  submitTenantReport: (...args: unknown[]) => submitTenantReport(...args),
  T02_CONFIRMATION_COOKIE: { name: "rr_t02", maxAgeSeconds: 1800 },
}));

import { submitReport } from "../../src/app/(tenant)/u/[token]/actions";
import { T } from "./fixtures";

beforeEach(() => {
  set.mockReset();
  submitTenantReport.mockReset();
});

describe("submitReport", () => {
  it("sets the confirmation cookie for a door-token report and returns only the result", async () => {
    submitTenantReport.mockResolvedValue({ result: { status: "reported", requestNumber: "R-0412" }, confirmation: "1798000000000.sig" });
    const result = await submitReport(T.aDoorOccupied, new FormData());
    expect(result).toEqual({ status: "reported", requestNumber: "R-0412" });
    expect(set).toHaveBeenCalledTimes(1);
    const [name, value, options] = set.mock.calls[0];
    expect([name, value]).toEqual(["rr_t02", "1798000000000.sig"]);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "strict", path: `/u/${T.aDoorOccupied}/reported`, maxAge: 1800 });
  });

  it("sets no cookie when there is no confirmation (tenant link, refused or failed submit)", async () => {
    for (const result of [
      { status: "reported", requestNumber: "R-0413" },
      { status: "retry", message: "Could not submit. Please try again." },
      { status: "invalid-link" },
    ]) {
      submitTenantReport.mockResolvedValue({ result, confirmation: null });
      await expect(submitReport(T.aActive, new FormData())).resolves.toEqual(result);
    }
    expect(set).not.toHaveBeenCalled();
  });
});
