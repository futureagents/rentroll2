"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "./icons";
import { BOTTOM_BAR_NAV, MORE_SHEET_NAV, isActive, type NavItem } from "./nav";

// A3 bottom bar (under 640px, A4): "Five items only: Dashboard, Rent, Maintenance, Units,
// More. 'More' opens a sheet with the rest." Status is never colour alone: the active item
// keeps its label and a primary-soft fill.

const itemClass = (active: boolean) =>
  [
    "flex h-full flex-col items-center justify-center gap-1 rounded-sm text-label uppercase",
    active ? "bg-primary-soft text-primary" : "text-muted hover:text-ink",
  ].join(" ");

function BarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link href={item.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

// PROMOTE: bottom sheet — A2 has no sheet row; it is the mobile form of Detail panel (slides
// up, closes on Escape, backdrop click and the close button). Should join src/components/ui.
function MoreSheet({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 sm:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className="absolute inset-x-0 bottom-0 rounded-t-md bg-surface p-4 pb-6 shadow-2"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-label uppercase text-muted">More</span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-sm px-2 text-small text-body hover:bg-canvas"
          >
            Close
          </button>
        </div>
        <ul className="flex flex-col">
          {MORE_SHEET_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex h-12 items-center gap-3 rounded-sm px-3 text-body",
                    active ? "bg-primary-soft font-semibold text-primary" : "text-body hover:bg-canvas",
                  ].join(" ")}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function BottomBar() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreActive = MORE_SHEET_NAV.some((item) => isActive(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 h-16 border-t border-line bg-surface sm:hidden"
      >
        <ul className="grid h-full grid-cols-5 gap-1 p-1">
          {BOTTOM_BAR_NAV.map((item) => (
            <BarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
              className={`w-full ${itemClass(moreActive)}`}
            >
              <Icon name="more" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
      {sheetOpen ? <MoreSheet pathname={pathname} onClose={() => setSheetOpen(false)} /> : null}
    </>
  );
}
