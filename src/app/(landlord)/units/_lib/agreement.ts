// L11-SEC-AGREEMENT countdown: shown "when within 90 days" of the current agreement's end, and
// once it has expired (an expired agreement stays until renewed or ended, L-12). Bands follow
// L-12: under 30 days danger, 30–60 warning, 60–90 neutral; 30 and 60 go to the lower band
// (decisions §9). Wording for expiry is L-12's "Expired 14 days ago".
import type { ChipTone } from "@/components/ui";

import { daysBetween, type IsoDate } from "./dates";

export const COUNTDOWN_WINDOW_DAYS = 90;

export function agreementCountdown(endsOn: IsoDate, today: IsoDate): { tone: ChipTone; label: string } | null {
  const days = daysBetween(today, endsOn);
  if (days > COUNTDOWN_WINDOW_DAYS) return null;
  if (days < 0) {
    const ago = -days;
    return { tone: "danger", label: ago === 1 ? "Expired 1 day ago" : `Expired ${ago} days ago` };
  }
  const label = days === 0 ? "Ends today" : days === 1 ? "Ends in 1 day" : `Ends in ${days} days`;
  const tone: ChipTone = days <= 30 ? "danger" : days <= 60 ? "warning" : "neutral";
  return { tone, label };
}
