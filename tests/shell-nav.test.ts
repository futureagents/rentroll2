import { describe, expect, it } from "vitest";

import {
  BOTTOM_BAR_NAV,
  MORE_SHEET_NAV,
  PRIMARY_NAV,
  SETTINGS_NAV,
  isActive,
} from "../src/components/shell/nav";

// A3 · Global navigation — the item lists and route mapping the shell is built from.
describe("A3 navigation", () => {
  it("sidebar lists the eight screens in spec order with Settings apart", () => {
    expect(PRIMARY_NAV.map((i) => i.label)).toEqual([
      "Dashboard",
      "Rent",
      "Maintenance",
      "Units",
      "Tenants",
      "Agreements",
      "Deposits",
      "Documents",
    ]);
    expect(SETTINGS_NAV.screen).toBe("L-15");
  });

  it("maps items to the routes in the screen files and D-39", () => {
    const routes = Object.fromEntries([...PRIMARY_NAV, SETTINGS_NAV].map((i) => [i.screen, i.href]));
    expect(routes).toEqual({
      "L-03": "/landlord",
      "L-04": "/rent",
      "L-06": "/maintenance",
      "L-08": "/units",
      "L-10": "/tenants",
      "L-12": "/agreements",
      "L-13": "/deposits",
      "L-14": "/documents",
      "L-15": "/settings",
    });
  });

  it("bottom bar shows four items plus More, and More covers everything else exactly once", () => {
    expect(BOTTOM_BAR_NAV.map((i) => i.label)).toEqual(["Dashboard", "Rent", "Maintenance", "Units"]);
    const all = [...BOTTOM_BAR_NAV, ...MORE_SHEET_NAV].map((i) => i.href).sort();
    const expected = [...PRIMARY_NAV, SETTINGS_NAV].map((i) => i.href).sort();
    expect(all).toEqual(expected);
  });

  it("keeps a section active on its sub-pages only", () => {
    expect(isActive("/rent", "/rent")).toBe(true);
    expect(isActive("/rent/42", "/rent")).toBe(true); // L-05 opens over L-04
    expect(isActive("/rentals", "/rent")).toBe(false);
    expect(isActive("/tenants/7", "/units")).toBe(false);
  });
});
