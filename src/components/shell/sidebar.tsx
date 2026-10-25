"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "./account-menu";
import { Icon } from "./icons";
import { PRIMARY_NAV, SETTINGS_NAV, isActive, isTenantPath, type NavItem } from "./nav";

// A3 sidebar. Over 1024px: fixed 220px with logo, the eight items, then Settings and the
// account menu (D-39) at the bottom. 640–1024px (A4): collapses to icons; labels become
// tooltips. Hidden under 640px, where the bottom bar takes over.
// Active item: primary-soft background and a 3px left bar (A3).

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={[
          "flex h-10 items-center gap-3 border-l-[3px] px-3 text-body transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:px-4",
          active
            ? "border-primary bg-primary-soft font-semibold text-primary"
            : "border-transparent text-body hover:bg-canvas hover:text-ink",
        ].join(" ")}
      >
        <Icon name={item.icon} className="size-5 shrink-0" />
        <span className="sr-only lg:not-sr-only">{item.label}</span>
      </Link>
    </li>
  );
}

export function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  // A3: tenant screens have no navigation at all. Structural guard, see isTenantPath.
  if (isTenantPath(pathname)) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-20 hidden w-16 flex-col border-r border-line bg-surface sm:flex lg:w-[220px]"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4 lg:px-5">
        <Link href="/landlord" className="text-h2 text-ink" aria-label="RentRoll home">
          <span className="lg:hidden" aria-hidden="true">
            R
          </span>
          <span className="hidden lg:inline">RentRoll</span>
        </Link>
      </div>
      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto py-3">
        {PRIMARY_NAV.map((item) => (
          <SidebarItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </ul>
      <div className="shrink-0 border-t border-line py-2">
        <ul>
          <SidebarItem item={SETTINGS_NAV} active={isActive(pathname, SETTINGS_NAV.href)} />
        </ul>
        <AccountMenu email={email} />
      </div>
    </nav>
  );
}
