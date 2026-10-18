import type { ReactNode } from "react";

// A3 page header: title on the left, the primary action on the right, optional filter row
// beneath. Sticky so it persists while the table scrolls.
export function PageHeader({
  title,
  action,
  filters,
}: {
  title: string;
  /** The one primary action for the screen (A2: maximum one per region). */
  action?: ReactNode;
  /** Filter controls shown on the row beneath the title. */
  filters?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas px-4 pt-4 pb-3 lg:px-6">
      <div className="flex min-h-10 items-center justify-between gap-4">
        <h1 className="text-h1 text-ink">{title}</h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {filters ? <div className="mt-3">{filters}</div> : null}
    </header>
  );
}
