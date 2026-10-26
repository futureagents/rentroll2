"use client";
// L06-CRD-REQUEST: "Unit number · category · first line of the description · urgency chip ·
// photo thumbnail if present · age in days". Opens L-07. On the desktop board it is draggable
// between columns; the status dropdown on L-07 is the keyboard route for the same move (E5).
import Link from "next/link";
import type { DragEvent } from "react";

import { StatusChip } from "@/components/ui";

import { ageLabel, ageing, firstLine } from "../_lib/board";
import { CATEGORY_LABEL, URGENCY_LABEL, URGENCY_TONE, type BoardCard } from "../_lib/model";

export const CARD_MIME = "application/x-rentroll-request";

const AGEING_BORDER = {
  none: "",
  warning: "border-l-warning",
  danger: "border-l-danger",
} as const;

const AGEING_TEXT = {
  none: null,
  warning: "Waiting more than 48 hours",
  danger: "Waiting more than 7 days",
} as const;

export function RequestCard({
  card,
  now,
  showProperty,
  selected,
  draggable,
}: {
  card: BoardCard;
  now: Date;
  showProperty: boolean;
  selected: boolean;
  draggable?: boolean;
}) {
  const age = ageing(card.status, card.createdAt, now);
  const onDragStart = (event: DragEvent<HTMLAnchorElement>) => {
    event.dataTransfer.setData(CARD_MIME, card.id);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Link
      href={`/maintenance/${card.id}`}
      scroll={false}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      aria-current={selected ? "true" : undefined}
      className={[
        // L-06 rule: the ageing border is "a subtle left border", a visual only.
        "flex gap-3 rounded-md border border-l-[3px] bg-surface p-3 shadow-1 transition-colors",
        "hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected ? "border-primary bg-primary-soft" : "border-line",
        AGEING_BORDER[age],
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-ink">
            Flat {card.unitNumber}
            {showProperty ? <span className="font-normal text-muted"> · {card.propertyName}</span> : null}
          </span>
          <StatusChip tone={URGENCY_TONE[card.urgency]}>{URGENCY_LABEL[card.urgency]}</StatusChip>
        </div>
        <span className="text-small text-muted">
          {card.requestNumber} · {CATEGORY_LABEL[card.category]}
        </span>
        <p className="truncate text-body">{firstLine(card.description)}</p>
        <span className="text-small text-muted">
          {ageLabel(card.createdAt, now)}
          {AGEING_TEXT[age] ? <span className="sr-only"> · {AGEING_TEXT[age]}</span> : null}
        </span>
      </div>
      {card.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private bucket
        <img
          src={card.thumbnailUrl}
          alt="Photo of the problem"
          className="h-14 w-14 shrink-0 rounded-sm border border-line object-cover"
        />
      ) : null}
    </Link>
  );
}
