"use client";
// L-15 · Settings screen. Sections save independently; the screen only knows which of them hold
// unsaved edits (for the leave warning) and whether the browser is offline (E1-08 banner).
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import { SECTION_NAMES, type LandlordSettings, type SectionId } from "@/lib/settings";

import { ContactsSection } from "./contacts-section";
import { PaymentSection } from "./payment-section";
import { RemindersSection } from "./reminders-section";
import { SystemSection } from "./system-section";
import { LeaveGuard } from "./_components/leave-guard";

const ORDER: SectionId[] = ["payment", "reminders", "contacts"];

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function SettingsScreen({
  settings,
  logoUrl,
  baseUrl,
}: {
  settings: LandlordSettings;
  logoUrl: string | null;
  baseUrl: { configured: string | null; effective: string | null };
}) {
  const [dirty, setDirty] = useState<Record<SectionId, boolean>>({ payment: false, reminders: false, contacts: false });
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  const onPayment = useCallback((d: boolean) => setDirty((s) => (s.payment === d ? s : { ...s, payment: d })), []);
  const onReminders = useCallback((d: boolean) => setDirty((s) => (s.reminders === d ? s : { ...s, reminders: d })), []);
  const onContacts = useCallback((d: boolean) => setDirty((s) => (s.contacts === d ? s : { ...s, contacts: d })), []);
  const dirtySections = useMemo(() => ORDER.filter((id) => dirty[id]).map((id) => SECTION_NAMES[id]), [dirty]);

  return (
    <>
      <div className="flex flex-col gap-6 p-4 lg:p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-h1 text-ink">Settings</h1>
          <p className="text-small text-muted">Each section saves on its own. Signed in as {settings.email}.</p>
        </header>

        {!online && (
          <p role="status" className="rounded-sm border border-warning bg-warning/12 p-3 text-small text-ink">
            You are offline. We will save this when you reconnect.
          </p>
        )}

        <nav aria-label="Settings sections" className="flex flex-wrap gap-2 text-small">
          {[...ORDER.map((id) => [id, SECTION_NAMES[id]] as const), ["system", "System"] as const].map(([id, name]) => (
            <a key={id} href={`#${id}`} className="rounded-sm border border-line bg-surface px-3 py-1 text-primary hover:bg-primary-soft">
              {name}
              {id !== "system" && dirty[id as SectionId] ? <span className="text-muted"> · unsaved</span> : null}
            </a>
          ))}
        </nav>

        <div className="flex max-w-3xl flex-col gap-6">
          <PaymentSection settings={settings} logoUrl={logoUrl} onDirtyChange={onPayment} />
          <RemindersSection settings={settings} onDirtyChange={onReminders} />
          <ContactsSection settings={settings} onDirtyChange={onContacts} />
          <SystemSection baseUrl={baseUrl} />
        </div>
      </div>
      <LeaveGuard dirtySections={dirtySections} />
    </>
  );
}
