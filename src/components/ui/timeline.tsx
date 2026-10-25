// A2 · Timeline. Vertical list of events, newest first, each with an icon, a line of text
// and a timestamp. Used for request history (L-07) and reminder history (L-05).
import { formatDateTime } from "./format";
import { Icon, type IconName } from "./icons";

export interface TimelineEvent {
  id: string;
  icon: IconName;
  /** One line. */
  text: string;
  /** ISO timestamp or Date. */
  at: string | Date;
  /** Colours the icon; body by default. */
  tone?: "body" | "success" | "warning" | "danger" | "primary";
}

export interface TimelineProps {
  events: TimelineEvent[];
  /** E3 skeleton. */
  loading?: boolean;
  /** Shown when there are no events; the screen supplies E2 wording. */
  empty?: string;
  className?: string;
}

const TONE: Record<NonNullable<TimelineEvent["tone"]>, string> = {
  body: "text-body bg-canvas",
  success: "text-success bg-success/12",
  warning: "text-warning bg-warning/12",
  danger: "text-danger bg-danger/12",
  primary: "text-primary bg-primary-soft",
};

export function Timeline({ events, loading, empty, className = "" }: TimelineProps) {
  if (loading) {
    return (
      <ol className={`flex flex-col gap-4 ${className}`} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3">
            <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-line" />
            <span className="flex flex-1 flex-col gap-2 pt-1">
              <span className="h-3 w-3/4 animate-pulse rounded-sm bg-line" />
              <span className="h-3 w-24 animate-pulse rounded-sm bg-line" />
            </span>
          </li>
        ))}
        <li className="sr-only">Loading history</li>
      </ol>
    );
  }
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (sorted.length === 0) {
    return <p className={`text-small text-muted ${className}`}>{empty ?? "Nothing has happened yet."}</p>;
  }
  return (
    <ol className={`relative flex flex-col ${className}`}>
      {sorted.map((event, index) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < sorted.length - 1 && (
            <span aria-hidden="true" className="absolute left-4 top-8 bottom-0 w-px bg-line" />
          )}
          <span
            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE[event.tone ?? "body"]}`}
          >
            <Icon name={event.icon} />
          </span>
          <div className="flex min-w-0 flex-col pt-1">
            <p className="text-body text-ink">{event.text}</p>
            <time dateTime={new Date(event.at).toISOString()} className="text-small text-muted">
              {formatDateTime(event.at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
