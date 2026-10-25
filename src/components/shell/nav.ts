// A3 · Global navigation — the single list of landlord navigation items.
// Routes come from the screen files (L-04 `/rent`, L-06 `/maintenance`, L-08 `/units`,
// L-10 `/tenants`, L-12 `/agreements`, L-13 `/deposits`) and D-39 (L-14 `/documents`,
// L-15 `/settings`). Dashboard (L-03) points at `/landlord` until the dashboard lane lands.
// Pure data: no React here so tests can import it directly.

export type IconName =
  | "dashboard"
  | "rent"
  | "maintenance"
  | "units"
  | "tenants"
  | "agreements"
  | "deposits"
  | "documents"
  | "settings"
  | "account"
  | "more";

export type NavItem = {
  /** Spec screen ID this item opens. */
  screen: string;
  label: string;
  href: string;
  icon: IconName;
};

/** Sidebar order (A3): Dashboard, Rent, Maintenance, Units, Tenants, Agreements, Deposits, Documents. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { screen: "L-03", label: "Dashboard", href: "/landlord", icon: "dashboard" },
  { screen: "L-04", label: "Rent", href: "/rent", icon: "rent" },
  { screen: "L-06", label: "Maintenance", href: "/maintenance", icon: "maintenance" },
  { screen: "L-08", label: "Units", href: "/units", icon: "units" },
  { screen: "L-10", label: "Tenants", href: "/tenants", icon: "tenants" },
  { screen: "L-12", label: "Agreements", href: "/agreements", icon: "agreements" },
  { screen: "L-13", label: "Deposits", href: "/deposits", icon: "deposits" },
  { screen: "L-14", label: "Documents", href: "/documents", icon: "documents" },
];

/** Sits at the bottom of the sidebar (A3), above the account menu (D-39). */
export const SETTINGS_NAV: NavItem = {
  screen: "L-15",
  label: "Settings",
  href: "/settings",
  icon: "settings",
};

/** Bottom bar (A3, under 640px): "Five items only: Dashboard, Rent, Maintenance, Units, More." */
export const BOTTOM_BAR_NAV: readonly NavItem[] = PRIMARY_NAV.slice(0, 4);

/** Everything the bottom bar does not show; "More" opens a sheet with these (A3). */
export const MORE_SHEET_NAV: readonly NavItem[] = [...PRIMARY_NAV.slice(4), SETTINGS_NAV];

/** Where "Sign out" (D-39 account menu) lands: L-01. */
export const SIGN_IN_HREF = "/signin";

/**
 * An item is active when the current path is its route or a page beneath it
 * (`/rent/42` keeps Rent active, L-05 opens over L-04).
 */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * D-03: every tenant route lives under `/u/:token`. A3: tenant screens have no navigation
 * at all. The sidebar and bottom bar refuse to render on these paths, so even a tenant
 * page mistakenly mounted inside the landlord shell shows no navigation.
 */
export function isTenantPath(pathname: string): boolean {
  return pathname === "/u" || pathname.startsWith("/u/");
}
