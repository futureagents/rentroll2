// A2 · Status chip. Rounded pill, coloured background at 12% opacity, text in the full
// colour. Always includes a word: status is never colour alone (A1, E5).
// Tones follow the screens: success (Paid, Occupied), warning (1–9 days late, Notice
// period, 30–60 days), danger (10+ days late, Urgent, under 30 days), neutral (Due, Vacant,
// Normal, 60–90 days), muted (Low urgency, L-06; foundations OPEN read literally).
import type { ReactNode } from "react";

export type ChipTone = "success" | "warning" | "danger" | "neutral" | "muted" | "primary";

export interface StatusChipProps {
  tone: ChipTone;
  /** The word. Required. */
  children: ReactNode;
  className?: string;
}

const TONE: Record<ChipTone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
  neutral: "bg-neutral/12 text-neutral",
  muted: "bg-muted/12 text-muted",
  primary: "bg-primary/12 text-primary",
};

export function StatusChip({ tone, children, className = "" }: StatusChipProps) {
  return (
    <span
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2 text-small font-medium ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
