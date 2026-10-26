import { TENANT_MESSAGES } from "@/lib/tenant/report";

// E1-10 · Invalid tenant link. Full screen, and nothing else: no hint about what a valid link
// looks like, no navigation, no code (T-01 States). Every tenant-side failure renders this.
export function InvalidLink() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <p className="max-w-sm text-center text-h2 text-ink">{TENANT_MESSAGES.invalidLink}</p>
    </main>
  );
}
