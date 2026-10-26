"use client";
// Fixture scenarios for /dev/composer (S-01, D-41).
import { useState } from "react";

import { MessageComposerPreview } from "@/components/composer/message-composer";
import type { RentReminderContext } from "@/components/composer/types";
import { Button, ToastProvider } from "@/components/ui";

const base: RentReminderContext = {
  kind: "rent_reminder",
  rentEntryId: "00000000-0000-4000-8000-000000000000",
  recipient: { name: "Suresh Khan", firstName: "Suresh", phone: "+919876543210", email: "suresh@example.com" },
  unitLabel: "Flat 4C · Kulkarni Apartments",
  month: "2026-10-01",
  dueOn: "2026-10-05",
  daysOverdue: 21,
  amountDue: 18000,
  balance: 18000,
  ladderDays: [3, 10, 20],
  remindersSent: 0,
  callsLogged: 0,
  preselectedLevel: 1,
  agreementStartsOn: "2025-04-01",
  signOff: "Anita Kulkarni",
  payLink: "upi://pay?pa=anita%40okhdfc&pn=Anita%20Kulkarni&am=18000&tn=Rent%20%E2%80%94%20Flat%204C&cu=INR",
  staleNote: "You last updated this board 9 days ago — check before sending.",
};

const SCENARIOS: { label: string; context: RentReminderContext }[] = [
  { label: "Day 21, nothing sent yet → Gentle, stale board", context: base },
  {
    label: "Day 21, two contacts → Formal, part paid",
    context: { ...base, remindersSent: 1, callsLogged: 1, preselectedLevel: 3, balance: 4000, staleNote: null },
  },
  {
    label: "No UPI ID, no email",
    context: { ...base, payLink: null, recipient: { ...base.recipient, email: null }, staleNote: null },
  },
];

export function ComposerPreview() {
  const [open, setOpen] = useState<RentReminderContext | null>(null);
  const [last, setLast] = useState<string>("");
  return (
    <ToastProvider>
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-h1 text-ink">S-01 composer preview</h1>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((scenario) => (
            <Button key={scenario.label} variant="secondary" onClick={() => setOpen(scenario.context)}>
              {scenario.label}
            </Button>
          ))}
        </div>
        {last && <p className="text-small text-muted">Closed: {last}</p>}
        {open && (
          <MessageComposerPreview
            context={open}
            onClose={({ recorded }) => {
              setOpen(null);
              setLast(recorded ? "recorded" : "nothing recorded");
            }}
          />
        )}
      </main>
    </ToastProvider>
  );
}
