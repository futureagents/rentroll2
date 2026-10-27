// S-03 · Share and copy. Screens import from "@/components/share".
// PROMOTE: whole folder → A2 S-03 in src/components/ui, replacing src/components/ui/share.tsx.
export { CopyAction, ShareAction, useCanShare, LINK_UNAVAILABLE, type CopyActionProps, type ShareActionProps } from "./share-action";
export { ShareLink, LinkText, type ShareLinkProps } from "./share-link";
export { ManualCopyDialog, type ManualCopyDialogProps, type ManualCopyReason } from "./manual-copy-dialog";
export {
  browserPlatform,
  canOpenShareSheet,
  copiedLabel,
  copiedMessage,
  isAbsoluteLink,
  midSentence,
  startCopy,
  startShare,
  type SharePlatform,
  type ShareOutcome,
} from "./platform";
