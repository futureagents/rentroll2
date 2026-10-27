"use client";
// S-03 · Share and copy. One share action for every screen:
// - S03-BTN-SHARE opens the device share sheet where the browser has one, and everywhere else is
//   the copy action, so a share icon never sits on screen doing nothing.
// - S03-BTN-COPY copies, the icon becomes a tick for 2 seconds, and the E1-03 toast (2 seconds)
//   names what was copied: "Tenant link copied." The tick and the toast wait for the clipboard to
//   confirm the write; a refused write opens the manual-copy dialog instead (manual-copy-dialog).
// The clipboard write and the share sheet are started directly from the click, never after an
// await (platform.ts). Links arrive whole from the server, built on APP_BASE_URL; a relative link
// is refused, never completed from the page's own address.
//
// PROMOTE: S-03 share and copy (CopyAction, ShareAction, ShareLink, ManualCopyDialog) → A2 Icon
// button row / S-03, replacing src/components/ui/share.tsx (whose toast fires before the write
// resolves and whose share swallows a sheet that did not open).
import {
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { Button, COPIED_MS, ToastView, type ButtonSize } from "@/components/ui";
import { ToastContext } from "@/components/ui/toast";

import { ManualCopyDialog, type ManualCopyReason } from "./manual-copy-dialog";
import {
  browserPlatform,
  canOpenShareSheet,
  copiedLabel,
  copiedMessage,
  isAbsoluteLink,
  midSentence,
  startCopy,
  startShare,
  type SharePlatform,
} from "./platform";

/** Shown on a link action whose link is not absolute (APP_BASE_URL missing upstream). */
export const LINK_UNAVAILABLE = "This link is unavailable until the app's address (APP_BASE_URL) is configured.";

interface ActionBase {
  /** What is being copied or shared, as the toast names it: "Tenant link", "UPI ID". */
  what: string;
  /** Tooltip and accessible label of the icon button; "Copy tenant link" by default. */
  label?: string;
  size?: ButtonSize;
  /** A labelled button ("Save this link") instead of the icon button. */
  children?: ReactNode;
  /** Labelled buttons only. Secondary by default. */
  variant?: "primary" | "secondary" | "quiet";
  block?: boolean;
  className?: string;
  /** The browser. Defaults to the real one; /dev/share passes stand-ins. */
  platform?: SharePlatform;
  onCopied?: () => void;
}

export interface CopyActionProps extends ActionBase {
  /** The exact text that lands on the clipboard. */
  value: string;
}

export interface ShareActionProps extends ActionBase {
  /** Absolute link, built on the server from APP_BASE_URL. Also what the copy fallback copies. */
  url: string;
  /** Share-sheet title and message; the link is added by the sheet. */
  title?: string;
  text?: string;
  /** A target was picked in the share sheet. */
  onShared?: () => void;
}

const subscribeNever = () => () => undefined;

/** Hydration-safe: the server renders copy, browsers with a share sheet switch after hydration. */
export function useCanShare(data: ShareData, platform?: SharePlatform): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => canOpenShareSheet(platform ?? browserPlatform(), data),
    () => false,
  );
}

/** The copy half: tick, toast, and the manual fallback when the clipboard refuses. */
function useCopyFlow(what: string, platform: SharePlatform | undefined, onCopied?: () => void) {
  const toast = useContext(ToastContext);
  // When the last confirmed copy happened; the tick shows for COPIED_MS and a re-click restarts it.
  const [copiedAt, setCopiedAt] = useState(0);
  // The screen's toast when it has a ToastProvider, otherwise one owned here, so the copy is
  // never silent on a screen that forgot the provider.
  const [localToast, setLocalToast] = useState<{ id: number; message: string } | null>(null);
  const [manual, setManual] = useState<{ reason: ManualCopyReason; value: string } | null>(null);

  useEffect(() => {
    if (!copiedAt) return;
    const timer = window.setTimeout(() => setCopiedAt(0), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copiedAt]);

  useEffect(() => {
    if (!localToast) return;
    const timer = window.setTimeout(() => setLocalToast(null), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [localToast]);

  const confirmCopied = () => {
    setManual(null);
    const now = Date.now();
    setCopiedAt(now);
    const message = copiedMessage(what); // E1-03
    if (toast) toast.show({ message, duration: COPIED_MS });
    else setLocalToast({ id: now, message });
    onCopied?.();
  };

  /** Call from the click handler, before any await. */
  const copy = (value: string) => {
    startCopy(value, platform ?? browserPlatform()).then((copied) =>
      copied ? confirmCopied() : setManual({ reason: "clipboard", value }),
    );
  };

  const overlays = (
    <>
      {manual && (
        <ManualCopyDialog
          open
          reason={manual.reason}
          value={manual.value}
          what={what}
          platform={platform ?? browserPlatform()}
          onCopied={confirmCopied}
          onClose={() => setManual(null)}
        />
      )}
      {localToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <ToastView key={localToast.id} message={localToast.message} className="pointer-events-auto" />
        </div>
      )}
    </>
  );

  return { copied: copiedAt > 0, copy, openManual: setManual, overlays };
}

function ActionButton({
  icon,
  label,
  copied,
  props,
  onClick,
}: {
  icon: "copy" | "share";
  label: string;
  copied: boolean;
  props: ActionBase;
  onClick: () => void;
}) {
  const shown = copied ? "check" : icon;
  const tone = copied ? "text-success" : "";
  if (props.children !== undefined) {
    return (
      <Button
        variant={props.variant ?? "secondary"}
        icon={shown}
        size={props.size}
        block={props.block}
        onClick={onClick}
        className={props.className}
      >
        {props.children}
      </Button>
    );
  }
  return (
    <Button
      variant="icon"
      icon={shown}
      label={copied ? copiedLabel(props.what) : label}
      size={props.size}
      onClick={onClick}
      className={`${tone} ${props.className ?? ""}`}
    />
  );
}

/** S03-BTN-COPY. */
export function CopyAction(props: CopyActionProps) {
  const { value, what, label = `Copy ${midSentence(what)}`, platform, onCopied } = props;
  const flow = useCopyFlow(what, platform, onCopied);
  return (
    <>
      <ActionButton icon="copy" label={label} copied={flow.copied} props={props} onClick={() => flow.copy(value)} />
      {flow.overlays}
    </>
  );
}

/** S03-BTN-SHARE: the share sheet where there is one, the copy action everywhere else. */
export function ShareAction(props: ShareActionProps) {
  const { url, what, title, text, platform, onCopied, onShared } = props;
  const data: ShareData = { title, text, url };
  const canShare = useCanShare(data, platform);
  const flow = useCopyFlow(what, platform, onCopied);

  if (!isAbsoluteLink(url)) {
    return (
      <Button
        variant="icon"
        icon="share"
        label={props.label ?? `Share ${midSentence(what)}`}
        size={props.size}
        disabled
        disabledReason={LINK_UNAVAILABLE}
        className={props.className}
      />
    );
  }

  if (!canShare) {
    return (
      <>
        <ActionButton
          icon="copy"
          label={`Copy ${midSentence(what)}`}
          copied={flow.copied}
          props={props}
          onClick={() => flow.copy(url)}
        />
        {flow.overlays}
      </>
    );
  }

  const onClick = () => {
    // Directly from the click: the sheet needs the gesture. A sheet that would not open (blocked
    // by the page, or by the browser) cannot fall back to an automatic copy here, because that
    // copy would come after an await; the link is offered selected for copying by hand instead.
    startShare(data, platform ?? browserPlatform()).then((outcome) => {
      if (outcome === "shared") onShared?.();
      if (outcome === "blocked") flow.openManual({ reason: "share", value: url });
    });
  };

  return (
    <>
      <ActionButton
        icon="share"
        label={props.label ?? `Share ${midSentence(what)}`}
        copied={false}
        props={props}
        onClick={onClick}
      />
      {flow.overlays}
    </>
  );
}
