"use client";
// S-03 · Share and copy. Two icon buttons built on the A2 icon button.
// S03-BTN-COPY copies, then the icon changes to a tick for 2 seconds; the clipboard call is
// made directly from the click handler, never after an await, because browsers only honour
// clipboard writes and the share sheet inside the user gesture. E1-03 "Copied." toast
// (2 seconds) shows when a <ToastProvider> is present.
// S03-BTN-SHARE uses the device share sheet where available and otherwise becomes the copy
// button, so it never shows a broken share icon.
import { useContext, useEffect, useState, useSyncExternalStore } from "react";
import { Button, type ButtonSize } from "./button";
import { ToastContext } from "./toast";

/** How long the tick and the E1-03 toast stay. */
export const COPIED_MS = 2000;
export const COPIED_MESSAGE = "Copied.";

/**
 * Copies `text` to the clipboard. Call it synchronously inside a click handler. Returns
 * false only when no clipboard route exists at all (server render, very old browser).
 * Without the async clipboard API (plain-http testing on a LAN) the legacy command runs
 * instead, still inside the gesture.
 */
export function copyText(text: string): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    navigator.clipboard.writeText(text).catch(() => undefined);
    return true;
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.className = "fixed opacity-0";
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

export interface CopyButtonProps {
  /** What gets copied. */
  text: string;
  /** Tooltip and accessible label; "Copy" by default. */
  label?: string;
  size?: ButtonSize;
  /** Called after the copy, e.g. to record it. */
  onCopied?: () => void;
  className?: string;
}

export function CopyButton({ text, label = "Copy", size, onCopied, className }: CopyButtonProps) {
  // When the last copy happened; the tick shows for COPIED_MS after it and a re-click restarts it.
  const [copiedAt, setCopiedAt] = useState(0);
  const copied = copiedAt > 0;
  const toast = useContext(ToastContext);

  useEffect(() => {
    if (!copiedAt) return;
    const timer = window.setTimeout(() => setCopiedAt(0), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copiedAt]);

  const onClick = () => {
    if (!copyText(text)) return; // first thing in the handler: never after an await (S-03)
    setCopiedAt(Date.now());
    toast?.show({ message: COPIED_MESSAGE, duration: COPIED_MS }); // E1-03
    onCopied?.();
  };

  return (
    <Button
      variant="icon"
      icon={copied ? "check" : "copy"}
      label={copied ? "Copied" : label}
      size={size}
      onClick={onClick}
      className={`${copied ? "text-success" : ""} ${className ?? ""}`}
    />
  );
}

export interface ShareButtonProps {
  /** The link being shared; also what the copy fallback copies. */
  url: string;
  title?: string;
  text?: string;
  /** Tooltip and accessible label; "Share" by default. The copy fallback says "Copy link". */
  label?: string;
  size?: ButtonSize;
  onShared?: () => void;
  className?: string;
}

const subscribeNever = () => () => undefined;
const shareSupported = () => typeof navigator.share === "function";
const noShareOnServer = () => false;

export function ShareButton({ url, title, text, label = "Share", size, onShared, className }: ShareButtonProps) {
  // Hydration-safe feature detection: the server renders the copy fallback, browsers with
  // the Web Share API switch to the sheet after hydration.
  const canShare = useSyncExternalStore(subscribeNever, shareSupported, noShareOnServer);
  if (!canShare) {
    return <CopyButton text={url} label="Copy link" size={size} onCopied={onShared} className={className} />;
  }
  const onClick = () => {
    // Directly from the click: the share sheet needs the user gesture. A dismissed sheet
    // rejects with AbortError, which is not an error for us.
    navigator
      .share({ title, text, url })
      .then(() => onShared?.())
      .catch(() => undefined);
  };
  return <Button variant="icon" icon="share" label={label} size={size} onClick={onClick} className={className} />;
}
