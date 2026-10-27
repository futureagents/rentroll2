"use client";
// S-03 · A link on screen with its copy and share actions (L09-BTN-COPYLINK + L09-BTN-SHARELINK,
// S02-BTN-COPYLINK). Long links never break the row: the link text shrinks first and is cut in the
// middle, so the start (the address) and the end (the part that tells two tokens apart) both stay
// visible; the full link is in the tooltip and is what selecting the text copies. Where the
// browser has no share sheet the share action would be a second copy button, so the row shows the
// one copy button instead.
// PROMOTE: link row with copy and share → A2 S-03 share and copy (with share-action.tsx).
import { CopyAction, LINK_UNAVAILABLE, ShareAction, useCanShare } from "./share-action";
import { isAbsoluteLink, type SharePlatform } from "./platform";
import type { ButtonSize } from "@/components/ui";

/** Characters kept whole at the end of a cut link. */
const TAIL = 10;

export interface ShareLinkProps {
  /** Absolute link built on the server from APP_BASE_URL; null when it cannot be built yet. */
  url: string | null;
  /** "Tenant link", "Door code link", "Payment link". */
  what: string;
  title?: string;
  text?: string;
  /** Shown instead of the row when `url` is null or not absolute. */
  unavailable?: string;
  size?: ButtonSize;
  platform?: SharePlatform;
  onCopied?: () => void;
  onShared?: () => void;
  className?: string;
}

export function ShareLink({
  url,
  what,
  title,
  text,
  unavailable = LINK_UNAVAILABLE,
  size,
  platform,
  onCopied,
  onShared,
  className = "",
}: ShareLinkProps) {
  const canShare = useCanShare({ title, text, url: url ?? undefined }, platform);
  if (!url || !isAbsoluteLink(url)) return <p className={`text-body ${className}`}>{unavailable}</p>;

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <LinkText url={url} className="flex-1" />
      <CopyAction value={url} what={what} size={size} platform={platform} onCopied={onCopied} />
      {canShare && (
        <ShareAction
          url={url}
          what={what}
          title={title}
          text={text}
          size={size}
          platform={platform}
          onCopied={onCopied}
          onShared={onShared}
        />
      )}
    </div>
  );
}

/** The link as text, cut in the middle when it does not fit. Never wraps, never widens its row. */
export function LinkText({ url, className = "" }: { url: string; className?: string }) {
  const cut = url.length > TAIL * 2;
  return (
    <code
      title={url}
      className={`flex min-w-0 rounded-sm bg-canvas px-2 py-1 text-small whitespace-nowrap text-body ${className}`}
    >
      {cut ? (
        <>
          <span className="min-w-0 truncate">{url.slice(0, -TAIL)}</span>
          <span className="shrink-0">{url.slice(-TAIL)}</span>
        </>
      ) : (
        <span className="min-w-0 truncate">{url}</span>
      )}
    </code>
  );
}
