// A2 · Stat card. Uppercase label, display-size number, optional comparison line. When it
// has a destination the whole card is the target, not just the number. Stat cards may
// abbreviate money (₹2.1L, D-19); tables never do.
import Link from "next/link";
import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  /** Pre-formatted figure, e.g. "₹2.1L" or "3". */
  value: ReactNode;
  /** Comparison line, e.g. "₹1.8L last month". */
  comparison?: ReactNode;
  /** Whole card becomes a link. */
  href?: string;
  /** E3 page-load skeleton. */
  loading?: boolean;
  /** Colour of the figure; ink by default, used for danger/warning totals. */
  tone?: "ink" | "success" | "warning" | "danger";
  className?: string;
}

const TONE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  ink: "text-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function StatCard({
  label,
  value,
  comparison,
  href,
  loading,
  tone = "ink",
  className = "",
}: StatCardProps) {
  const base = `flex flex-col gap-1 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6 ${className}`;
  const body = loading ? (
    <>
      <span className="h-3 w-24 animate-pulse rounded-sm bg-line" />
      <span className="mt-2 h-7 w-20 animate-pulse rounded-sm bg-line" />
      <span className="mt-1 h-3 w-32 animate-pulse rounded-sm bg-line" />
      <span className="sr-only">Loading {label}</span>
    </>
  ) : (
    <>
      <span className="text-label uppercase text-muted">{label}</span>
      <span className={`text-display tabular-nums ${TONE[tone]}`}>{value}</span>
      {comparison && <span className="text-small text-muted">{comparison}</span>}
    </>
  );
  if (href && !loading) {
    return (
      <Link
        href={href}
        className={`${base} transition-shadow hover:shadow-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
