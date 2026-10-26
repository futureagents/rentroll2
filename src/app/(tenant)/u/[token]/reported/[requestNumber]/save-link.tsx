"use client";
// T02-BTN-SAVE "Save this link" → the device share sheet so the tenant can bookmark it or message
// it to themselves; on desktop, copies to the clipboard with the E1-03 toast. The link is the one
// they arrived by (D-01: a tenant link, or the door link, which is enough to report again, D-02).
//
// PROMOTE: labelled secondary share button → A2 S-03 share (ShareButton is icon-only today).
import { useSyncExternalStore } from "react";

import { Button, COPIED_MESSAGE, COPIED_MS, ToastProvider, useToast } from "@/components/ui";
import { copyText } from "@/components/ui/share";

const subscribeNever = () => () => undefined;
const shareSupported = () => typeof navigator.share === "function";
const noShareOnServer = () => false;

function SaveLink({ path }: { path: string }) {
  const toast = useToast();
  const canShare = useSyncExternalStore(subscribeNever, shareSupported, noShareOnServer);

  const onClick = () => {
    // Inside the gesture, before any await: browsers only honour share and clipboard here (S-03).
    const url = new URL(path, window.location.origin).toString();
    if (canShare) {
      navigator.share({ title: "Report a problem", url }).catch(() => undefined);
      return;
    }
    if (copyText(url)) toast.show({ message: COPIED_MESSAGE, duration: COPIED_MS });
  };

  return (
    <Button variant="secondary" size={48} block icon={canShare ? "share" : "copy"} onClick={onClick}>
      Save this link
    </Button>
  );
}

export function SaveLinkButton({ path }: { path: string }) {
  return (
    <ToastProvider>
      <SaveLink path={path} />
    </ToastProvider>
  );
}
