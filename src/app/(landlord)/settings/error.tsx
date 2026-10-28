"use client";
// L-15 could not load (the database or the network failed). Say what happens next; no codes.
import { Button } from "@/components/ui";

export default function SettingsError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <h1 className="text-h1 text-ink">Settings</h1>
      <div className="flex max-w-3xl flex-col items-start gap-3 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6">
        <p className="text-body">Could not load your settings. Nothing has changed — try again.</p>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </div>
  );
}
