// T02-SEC-SUMMARY "What they reported, so they can see it was captured correctly."
//
// D-30 does not let tenant code read a request's description back, so T-02 shows what this
// device just sent: T-01 keeps a copy in sessionStorage for the confirmation, and T-02 falls back
// to the D-30 fields (category, date, photo count) after the tab is closed. Nothing here leaves
// the device.

export interface SentSummary {
  category: string;
  description: string;
  photoCount: number;
}

const key = (token: string, requestNumber: string) => `rentroll:t02:${token}:${requestNumber}`;

export function keepSummary(token: string, requestNumber: string, summary: SentSummary) {
  try {
    window.sessionStorage.setItem(key(token, requestNumber), JSON.stringify(summary));
  } catch {
    // Private mode or storage blocked: T-02 shows the D-30 fallback.
  }
}

export function readSummaryRaw(token: string, requestNumber: string): string | null {
  try {
    return window.sessionStorage.getItem(key(token, requestNumber));
  } catch {
    return null;
  }
}

export function parseSummary(raw: string | null): SentSummary | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SentSummary>;
    if (typeof value.category !== "string" || typeof value.description !== "string") return null;
    return { category: value.category, description: value.description, photoCount: Number(value.photoCount) || 0 };
  } catch {
    return null;
  }
}
