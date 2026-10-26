"use client";
// Opens S-01 for the three L-11 messages: the contact block's message and mail buttons, and
// L11-BTN-SENDAGREEMENT. Every message to a tenant goes through the composer; never mailto: or a
// WhatsApp link from here (proposed decision; one send path, G-1).
//
// INTEGRATION (S-01, lane/composer): the composer's ComposerTarget accepts only
// `{ kind: "rent_reminder"; rentEntryId }` today, and `message.kind` has no value for a free
// message or an agreement email. Until it does, these buttons render disabled with the reason,
// and nothing is sent or drafted here. Requested target shapes are in the lane PR.
import { Button, type ButtonSize } from "@/components/ui";

export type ComposerRequest =
  | { kind: "tenant_message"; tenancyId: string; channel: "whatsapp" | "email" }
  | { kind: "agreement_email"; tenancyId: string; agreementId: string };

const NOT_READY = "Messages are written and sent in the message composer, which is not connected here yet";

export function ComposerButton({
  request,
  label,
  icon,
  variant,
  size,
}: {
  request: ComposerRequest;
  label: string;
  icon?: "note" | "share";
  variant: "icon" | "quiet";
  size?: ButtonSize;
}) {
  void request; // the opener passes only ids, as S-01 requires (lane/composer types.ts)
  if (variant === "icon") return <Button variant="icon" icon={icon ?? "note"} label={label} size={size} disabled disabledReason={NOT_READY} />;
  return (
    <Button variant="quiet" size={size} disabled disabledReason={NOT_READY}>
      {label}
    </Button>
  );
}
