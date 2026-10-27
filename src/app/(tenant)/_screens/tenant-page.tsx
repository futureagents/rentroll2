import type { ReactNode } from "react";

import type { TenantHeader } from "@/server/tenant";

// The frame T-03, T-04 and T-05 share: the unit line so the tenant knows it is their link
// (T01-HDR), the page title, and the D-03 footer of the tenant's own three pages plus
// "Report a problem". Nothing else is linked (A3, Part C brief).

export type TenantPage = "reports" | "unit" | "receipts";

const LINKS: { page: TenantPage | null; label: string; path: string }[] = [
  { page: null, label: "Report a problem", path: "" },
  { page: "reports", label: "My reports", path: "/reports" },
  { page: "unit", label: "My unit", path: "/unit" },
  { page: "receipts", label: "My receipts", path: "/receipts" },
];

const BUTTON_LINK = {
  primary: "bg-primary text-surface border border-primary hover:bg-ink hover:border-ink",
  secondary: "bg-surface text-primary border border-primary hover:bg-primary-soft",
} as const;

// PROMOTE: A2 Button rendered as a link (`<a>` with the 48px tenant height). The A2 Button is a
// <button> only; T-01's call link inlines the same classes.
export function ButtonLink({
  href,
  variant = "primary",
  children,
  ...rest
}: {
  href: string;
  variant?: keyof typeof BUTTON_LINK;
  children: ReactNode;
  target?: string;
  rel?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm px-6 text-(length:--text-body) font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${BUTTON_LINK[variant]}`}
      {...rest}
    >
      {children}
    </a>
  );
}

export function TenantPageFrame({
  basePath,
  header,
  page,
  title,
  children,
}: {
  /** `/u/:token` (D-03). */
  basePath: string;
  header: TenantHeader;
  page: TenantPage;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:py-8">
      <header className="flex flex-col gap-1">
        <p className="text-small text-muted">
          {header.unitLabel}, {header.propertyName}
        </p>
        <h1 className="text-h1 text-ink">{title}</h1>
      </header>
      {children}
      <nav aria-label="Your pages" className="mt-auto border-t border-line pt-4">
        <ul className="grid grid-cols-2 gap-2">
          {LINKS.map((link) => {
            const current = link.page === page;
            return (
              <li key={link.label}>
                <a
                  href={`${basePath}${link.path}`}
                  aria-current={current ? "page" : undefined}
                  className={`flex h-12 items-center justify-center rounded-sm px-3 text-center font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    current ? "bg-primary-soft text-primary" : "text-primary hover:bg-canvas"
                  }`}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </main>
  );
}
