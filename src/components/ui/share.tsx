"use client";
// S-03 · Share and copy. Two icon buttons built on the A2 icon button.
// S03-BTN-COPY copies, then the icon changes to a tick for 2 seconds; the clipboard call is
// made directly from the click handler, never after an await, because browsers only honour
// clipboard writes and the share sheet inside the user gesture. E1-03 "Copied." toast
// (2 seconds) shows when a <ToastProvider> is present.
// S03-BTN-SHARE uses the device share sheet where available and otherwise becomes the copy
// button, so it never shows a broken share icon.
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, type ButtonSize } from "./button";
import { ToastContext } from "./toast";

/** How long the tick and the E1-03 toast stay. */
export const COPIED_MS = 2000;
export const COPIED_MESSAGE = "Copied.";

/**
 * Copies `text` to the clipboard. Call it synchronously inside a click handler. Returns
 * false only when no clipboard route exists at all (server render, very old browser).
 */
export function copyText(text: string): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
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
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const toast = useContext(ToastContext);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const onClick = () => {
    copyText(text); // first thing in the handler: never after an await (S-03)
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
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
  /** Tooltip and accessible label; "Share" by default. */
  label?: string;
  /** Label of the copy fallback; "Copy link" by default. */
  copyLabel?: string;
  size?: ButtonSize;
  onShared?: () => void;
  className?: string;
}

const subscribeNever = () => () => undefined;
const shareSupported = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const shareUnsupportedOnServer = () => false;

/** True once hydrated in a browser with the Web Share API; false on the server and on desktop browsers without it. */
export function useCanShare(): boolean {
  return useSyncExternalStore(subscribeNever, shareSupported, shareUnsupportedOnServer);
}

export function ShareButton({
  url,
  title,
  text,
  label = "Share",
  copyLabel = "Copy link",
  size,
  onShared,
  className,
}: ShareButtonProps) {
  const canShare = useCanShare();
  if (!canShare) {
    return <CopyButton text={url} label={copyLabel} size={size} onCopied={onShared} className={className} />;
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
