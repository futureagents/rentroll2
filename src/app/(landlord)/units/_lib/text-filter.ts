// The client-side filter box on L-08 and L-10. v1 has no global search (A3), and fifty units
// with no way to narrow them is not usable, so both lists take a free-text filter.
//
// Every word typed must appear somewhere in the row (AND), case-insensitively, in any of the
// fields the screen passes: on L-08 unit, property, type, tenant and the status word (so
// L03-CRD-OCCUPANCY can route to `/units?q=vacant`); on L-10 name, unit, property, phone and status.
// Phone numbers also match on their digits alone, so "98765" finds "+91 98765 43210".

export function normaliseQuery(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesText(query: string, fields: (string | null | undefined)[]): boolean {
  const words = normaliseQuery(query);
  if (words.length === 0) return true;
  const haystack = fields
    .filter((f): f is string => Boolean(f))
    .flatMap((f) => {
      const lower = f.toLowerCase();
      const digits = f.replace(/\D/g, "");
      return digits.length >= 3 && digits !== lower ? [lower, digits] : [lower];
    })
    .join(" \u0000 ");
  return words.every((word) => haystack.includes(word));
}

/** Reads `?q=` from page search params. */
export function parseQuery(value: string | string[] | null | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? "").slice(0, 100);
}
