// S-01 · The only place in the product that hands a drafted message to another app (G-1, D-28).
// Nothing here sends: WhatsApp and the mail app open with the text pre-filled and the landlord
// presses send there. tests/composer/single-send-path.test.ts fails if a pre-filled hand-off is
// built anywhere outside src/components/composer, or if this file is imported by anything other
// than the composer modal.
import { copyText } from "@/components/ui/share";

import type { SendChannel } from "./types";

/** The outgoing text: the field as edited, plus the payment link when S01-CHK-PAYLINK is ticked. */
export function outgoingText(message: string, payLink: string | null): string {
  const body = message.trim();
  return payLink ? `${body}\n\nPay by UPI: ${payLink}` : body;
}

/** `https://wa.me/91XXXXXXXXXX?text=…` for a stored `+91XXXXXXXXXX` phone. */
export function whatsappUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** `mailto:` with subject and body; encodeURIComponent so spaces stay %20, never "+". */
export function emailUrl(to: string, subject: string, text: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/**
 * Performs the hand-off for one channel. Call it synchronously from the click handler: browsers
 * honour window.open and clipboard writes only inside the user gesture (S-03). Returns false when
 * the hand-off could not happen (popup blocked, no clipboard), so the modal stays in editing
 * instead of asking "Did you send it?".
 */
export function handOff(
  channel: SendChannel,
  target: { phone: string; email: string | null; subject: string },
  text: string,
): boolean {
  if (channel === "whatsapp") {
    // With "noopener" window.open returns null even when the tab opens, so it cannot report a
    // blocked popup; the "Did you send it?" step covers that case ("Not yet").
    window.open(whatsappUrl(target.phone, text), "_blank", "noopener,noreferrer");
    return true;
  }
  if (channel === "email") {
    if (!target.email) return false;
    window.location.href = emailUrl(target.email, target.subject, text);
    return true;
  }
  return copyText(text);
}
