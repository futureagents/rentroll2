"use client";
// L-15 · warn before leaving with unsaved changes, naming the sections that have them.
//
// In-app links (the sidebar, the bottom bar, anything else on the page) are caught in the
// capture phase, before Next's <Link> handles them, and held behind a confirm dialog. Closing the
// tab or reloading gets the browser's own prompt (browsers no longer show custom text there).
// The browser Back button cannot be held by the App Router; noted in the lane PR.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui";

/** "Payment", "Payment and Reminders", "Payment, Reminders and Contacts". */
export function listSections(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function LeaveGuard({ dirtySections }: { dirtySections: readonly string[] }) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirty = dirtySections.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // Chrome and Edge still need it set
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return; // new tab or window: nothing on this page is lost
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same page, e.g. #payment
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const sections = listSections(dirtySections);
  return (
    <ConfirmDialog
      open={pendingHref !== null && dirty}
      title={`Leave without saving ${sections}?`}
      consequence={`Your changes to ${sections} have not been saved and will be lost.`}
      actionLabel="Leave without saving"
      cancelLabel="Stay and save"
      destructive
      onCancel={() => setPendingHref(null)}
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) router.push(href);
      }}
    />
  );
}
