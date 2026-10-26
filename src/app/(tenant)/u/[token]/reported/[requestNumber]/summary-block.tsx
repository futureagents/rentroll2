"use client";
// T02-SEC-SUMMARY "What they reported, so they can see it was captured correctly." The text the
// tenant typed comes from this device (../../summary.ts); the server only supplies D-30 fields.
import { useSyncExternalStore } from "react";

import type { OwnRequestView } from "@/lib/tenant/view";

import { parseSummary, readSummaryRaw } from "../../summary";

const subscribeNever = () => () => undefined;
const nothingOnServer = () => null;

export function SummaryBlock({ token, request }: { token: string; request: OwnRequestView }) {
  const raw = useSyncExternalStore(subscribeNever, () => readSummaryRaw(token, request.requestNumber), nothingOnServer);
  const sent = parseSummary(raw);
  const photoCount = sent?.photoCount ?? request.photoCount;

  return (
    <section aria-label="What you reported" className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-1">
      <dl className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <dt className="text-label uppercase text-muted">What is the problem?</dt>
          <dd className="text-ink">{sent?.category ?? request.category}</dd>
        </div>
        {sent && (
          <div className="flex flex-col gap-1">
            <dt className="text-label uppercase text-muted">Describe it</dt>
            <dd className="whitespace-pre-line break-words text-body">{sent.description}</dd>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <dt className="text-label uppercase text-muted">Photos</dt>
          <dd className="text-body">{photoCount === 0 ? "No photo" : photoCount === 1 ? "1 photo" : `${photoCount} photos`}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-label uppercase text-muted">Reported on</dt>
          <dd className="text-body">{request.reportedOn}</dd>
        </div>
      </dl>
    </section>
  );
}
