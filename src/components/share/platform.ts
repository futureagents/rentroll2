// S-03 · The browser calls behind the share and copy actions, kept apart from React so /dev/share
// can stand in a browser with no share sheet or a blocked clipboard.
//
// The rule every caller depends on: startCopy and startShare are called synchronously from the
// click handler, as its first browser call, never after an await. Safari drops the user gesture
// across an await, and a clipboard write outside the gesture is refused. Only the outcome is
// awaited, and the "copied" feedback waits for it: a refused write never shows a toast.

/** The parts of the browser the share and copy actions use. Missing members mean "not here". */
export interface SharePlatform {
  /** navigator.share: the device share sheet. Secure contexts only. */
  share?: (data: ShareData) => Promise<void>;
  /** navigator.canShare, where the browser has it. */
  canShare?: (data: ShareData) => boolean;
  /** navigator.clipboard.writeText. Secure contexts only. */
  writeText?: (text: string) => Promise<void>;
  /** document.execCommand("copy") on a hidden selection: plain-http testing on a LAN. */
  legacyCopy?: (text: string) => boolean;
}

/** The real browser, read at call time (never during a server render). */
export function browserPlatform(): SharePlatform {
  if (typeof navigator === "undefined") return {};
  return {
    share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
    canShare: typeof navigator.canShare === "function" ? (data) => navigator.canShare(data) : undefined,
    writeText:
      typeof navigator.clipboard?.writeText === "function"
        ? (text) => navigator.clipboard.writeText(text)
        : undefined,
    legacyCopy,
  };
}

/** True when tapping share opens a share sheet; otherwise the share action copies instead. */
export function canOpenShareSheet(platform: SharePlatform, data: ShareData): boolean {
  if (!platform.share) return false;
  try {
    return platform.canShare ? platform.canShare(data) : true;
  } catch {
    return false;
  }
}

/**
 * Starts the clipboard write now and resolves to whether it landed. Call it from the click,
 * before any await. A refused write (permission, focus, embedded frame) resolves false; it is
 * not retried after the await, because the retry would be outside the gesture and fail too.
 */
export function startCopy(text: string, platform: SharePlatform): Promise<boolean> {
  if (platform.writeText) {
    return platform.writeText(text).then(
      () => true,
      () => false,
    );
  }
  return Promise.resolve(platform.legacyCopy?.(text) ?? false);
}

/** shared: a target was picked · dismissed: the person closed the sheet · blocked: it did not open. */
export type ShareOutcome = "shared" | "dismissed" | "blocked";

/** Opens the share sheet now. Call it from the click, before any await. */
export function startShare(data: ShareData, platform: SharePlatform): Promise<ShareOutcome> {
  if (!platform.share) return Promise.resolve("blocked");
  return platform.share(data).then(
    () => "shared" as const,
    (reason: unknown) => {
      const name = reason instanceof Error || reason instanceof DOMException ? reason.name : "";
      // AbortError: closed without picking. InvalidStateError: a sheet is already open.
      return name === "AbortError" || name === "InvalidStateError" ? "dismissed" : "blocked";
    },
  );
}

/** The copy button's label for 2 seconds after a copy: "Tenant link copied". */
export function copiedLabel(what: string): string {
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} copied`;
}

/** E1-03, naming what was copied: "Tenant link copied." (proposed decision in the S-03 PR). */
export function copiedMessage(what: string): string {
  return `${copiedLabel(what)}.`;
}

/**
 * Links are built on the server from APP_BASE_URL and passed in whole. A relative path would be
 * completed from whatever address the page happens to be open on, which is how a wrong link
 * reaches a printed QR code, so it is refused rather than guessed.
 */
export function isAbsoluteLink(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.className = "fixed opacity-0";
  // Inside an open modal everything else is inert and cannot be selected, so the textarea goes
  // into the dialog that has focus.
  (document.activeElement?.closest("dialog[open]") ?? document.body).appendChild(area);
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
