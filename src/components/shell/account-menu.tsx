"use client";

import { useEffect, useId, useRef, useState } from "react";

import { signOut } from "./account";
import { Icon } from "./icons";

// D-39: "The sidebar 'account' item is a menu with the landlord's email and 'Sign out';
// no screen." Sits under Settings at the bottom of the sidebar (A3). At 640–1024px the
// sidebar is icons only, so the trigger shows the avatar initial and the menu carries
// the email.
//
// PROMOTE: popover menu — A2 has no menu row; this is a dropdown (shadow-2, radius-md)
// that closes on Escape, outside click and item choice. S-03's share menu needs the same.

export function AccountMenu({ email }: { email: string | null }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = (email ?? "A").trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={`${id}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={email ?? "Account"}
        onClick={() => setOpen((value) => !value)}
        className={[
          "flex h-12 w-full items-center gap-3 border-l-[3px] border-transparent px-3 text-left text-body transition-colors",
          "hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:px-4",
          open ? "bg-canvas text-ink" : "",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-small font-semibold text-primary"
        >
          {initial}
        </span>
        <span className="sr-only lg:not-sr-only lg:min-w-0 lg:flex-1 lg:truncate">
          {email ?? "Account"}
        </span>
        <Icon name="more" className="hidden size-4 shrink-0 text-muted lg:block" />
      </button>
      {open ? (
        <div
          id={`${id}-menu`}
          role="menu"
          aria-labelledby={`${id}-trigger`}
          className="absolute bottom-full left-2 z-30 mb-1 w-60 rounded-md border border-line bg-surface p-2 shadow-2"
        >
          <p className="truncate px-2 py-1 text-small text-muted" title={email ?? undefined}>
            {email ? `Signed in as ${email}` : "Not signed in"}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex h-10 w-full items-center rounded-sm px-2 text-left text-body hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/** The same two lines inside the mobile "More" sheet, where there is no room for a popover. */
export function AccountRows({ email }: { email: string | null }) {
  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="truncate px-3 py-1 text-small text-muted" title={email ?? undefined}>
        {email ? `Signed in as ${email}` : "Not signed in"}
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="flex h-12 w-full items-center gap-3 rounded-sm px-3 text-left text-body hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="account" />
          <span>Sign out</span>
        </button>
      </form>
    </div>
  );
}
