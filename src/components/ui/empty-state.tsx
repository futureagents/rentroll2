// A2 · Empty state. One line explaining what would appear here, and the button that
// creates the first one. Never just "No data". E2 lists some states with no action, so the
// button is optional.
import type { ReactNode } from "react";
import { Button } from "./button";

export interface EmptyStateProps {
  /** One line, from E2 wording. */
  message: string;
  /** Button label from E2 ("Add unit"), omitted when E2 says "None". */
  action?: { label: string; onClick: () => void; variant?: "primary" | "secondary" };
  /** Alternative to `action` when the screen supplies its own control (a link). */
  children?: ReactNode;
  className?: string;
}

export function EmptyState({ message, action, children, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-md border border-dashed border-line bg-surface p-8 text-center ${className}`}
    >
      <p className="text-body text-body">{message}</p>
      {action && (
        <Button variant={action.variant ?? "primary"} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
