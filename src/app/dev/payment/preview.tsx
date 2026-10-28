"use client";
// Fixture scenarios for /dev/payment (S-02, D-27). Nothing here sends or records anything:
// Send link only reports what S-01 would be opened with.
import { useRef, useState } from "react";

import {
  PaymentSheet,
  rentPaymentNote,
  type PayeeState,
  type PaymentPayee,
  type PaymentPlatform,
} from "@/components/payment";
import { Button, SegmentedChoice, ToastProvider } from "@/components/ui";
import { formatRupees } from "@/lib/format";

import { loadMyPayee } from "./actions";

const SAVED: PaymentPayee = { upiId: "anil.kulkarni@okhdfc", name: "Anil Kulkarni" };
const LONG_NAME: PaymentPayee = {
  upiId: "venkataraghavan.subramaniam.properties@okicici",
  name: "Venkataraghavan Subramaniam Chandrasekharan Property Management and Rentals",
};

type Source = "saved" | "none" | "long" | "slow" | "flaky" | "live";

interface Scenario {
  label: string;
  context: string;
  amount: number | null;
  note: string;
  source: Source;
}

const NOTE = rentPaymentNote("2026-02-01", "2A");
const CONTEXT = "Rent Feb 2026 · Flat 2A, Kulkarni Apartments";

const SCENARIOS: Scenario[] = [
  { label: "Rent, UPI ID saved", context: CONTEXT, amount: 18000, note: NOTE, source: "saved" },
  { label: "Large amount", context: CONTEXT, amount: 186000, note: NOTE, source: "saved" },
  { label: "No amount yet", context: CONTEXT, amount: null, note: NOTE, source: "saved" },
  { label: "No UPI ID saved", context: CONTEXT, amount: 18000, note: NOTE, source: "none" },
  {
    label: "Long landlord name",
    context: "Rent Feb 2026 · Flat 12B, Sri Lakshmi Venkateshwara Residency Phase II",
    amount: 186000,
    note: rentPaymentNote("2026-02-01", "12B"),
    source: "long",
  },
  { label: "Slow network (7s)", context: CONTEXT, amount: 18000, note: NOTE, source: "slow" },
  { label: "Load fails, retry works", context: CONTEXT, amount: 18000, note: NOTE, source: "flaky" },
  { label: "Your saved settings (live)", context: CONTEXT, amount: 18000, note: NOTE, source: "live" },
];

const PLATFORMS = [
  { value: "auto", label: "This device" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "desktop", label: "Desktop" },
] as const;

type PlatformChoice = (typeof PLATFORMS)[number]["value"];

export function PaymentPreview() {
  const [platform, setPlatform] = useState<PlatformChoice>("auto");
  const [open, setOpen] = useState<Scenario | null>(null);
  const [payee, setPayee] = useState<PayeeState>({ status: "loading" });
  const [last, setLast] = useState("");
  // Each open gets a number, so a slow load from a closed sheet cannot land in the next one.
  const generation = useRef(0);

  const load = (scenario: Scenario, attempt: number) => {
    const mine = ++generation.current;
    const set = (next: PayeeState) => {
      if (generation.current === mine) setPayee(next);
    };
    const ready = (p: PaymentPayee | null) => set({ status: "ready", payee: p });
    switch (scenario.source) {
      case "saved":
        return ready(SAVED);
      case "none":
        return ready(null);
      case "long":
        return ready(LONG_NAME);
      case "slow":
        set({ status: "loading" });
        window.setTimeout(() => ready(SAVED), 7000);
        return;
      case "flaky":
        set({ status: "loading" });
        window.setTimeout(() => {
          if (attempt === 0) set({ status: "failed", onRetry: () => load(scenario, attempt + 1) });
          else ready(SAVED);
        }, 1200);
        return;
      case "live":
        set({ status: "loading" });
        loadMyPayee()
          .then((result) => {
            if (result.ok) return ready(result.payee);
            if (result.reason === "signed_out") setLast("Sign in at /signin first to load your saved settings.");
            set({ status: "failed", onRetry: () => load(scenario, attempt + 1) });
          })
          .catch(() => set({ status: "failed", onRetry: () => load(scenario, attempt + 1) }));
        return;
    }
  };

  const openScenario = (scenario: Scenario) => {
    setLast("");
    setOpen(scenario);
    load(scenario, 0);
  };

  return (
    <ToastProvider>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-ink">S-02 payment sheet preview</h1>
          <p className="text-small text-muted">
            The landlord&apos;s payment sheet (D-27). Pick a device, then a scenario. Nothing is sent or recorded.
          </p>
        </div>

        <SegmentedChoice
          label="Device"
          options={PLATFORMS}
          value={platform}
          onChange={setPlatform}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SCENARIOS.map((scenario) => (
            <Button key={scenario.label} variant="secondary" onClick={() => openScenario(scenario)}>
              {scenario.label}
            </Button>
          ))}
        </div>

        {last && (
          <p role="status" className="text-small break-all text-body">
            {last}
          </p>
        )}

        {open && (
          <PaymentSheet
            context={open.context}
            amount={open.amount}
            note={open.note}
            payee={payee}
            platform={platform === "auto" ? undefined : (platform as PaymentPlatform)}
            onClose={() => setOpen(null)}
            onSendLink={(request, link) => {
              setOpen(null);
              setLast(`Send link: S-01 would open with ${formatRupees(request.amount)} and ${link}`);
            }}
          />
        )}
      </main>
    </ToastProvider>
  );
}
