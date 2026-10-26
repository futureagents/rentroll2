import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/ui";
import { reportedMessage, TENANT_MESSAGES } from "@/lib/tenant/report";
import { findOwnRequest, resolveTenantToken } from "@/server/tenant";

import { SaveLinkButton } from "./save-link";
import { SummaryBlock } from "./summary-block";

// T-02 · Submitted confirmation (/u/:token/reported/:requestNumber, D-03). Re-renders from the
// request number after a refresh; a number that is not this token's tenancy's shows E1-10 (D-03,
// E4-1). Reachable by both token kinds (D-02).
//
// T02-BTN-TRACK ("Check the status" → T-03) is not rendered for a tenant link yet: T-03 does not
// exist in this build. Under a door token it is replaced by a one-line note (D-02).

export const metadata: Metadata = { title: "Reported" };

export default async function ReportedPage({
  params,
}: {
  params: Promise<{ token: string; requestNumber: string }>;
}) {
  const { token, requestNumber } = await params;
  const resolved = await resolveTenantToken(token);
  if (!resolved) notFound();
  const request = await findOwnRequest(resolved, requestNumber);
  if (!request) notFound();

  const [before] = reportedMessage(request.requestNumber).split(request.requestNumber);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:py-8">
      {/* T02-SEC-CONFIRM · E1-06, with D-28's second line. */}
      <section className="flex flex-col items-center gap-3 pt-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-success/12 text-success">
          <Icon name="check" size={24} />
        </span>
        <h1 className="text-h1 text-ink">
          {before}
          <strong className="font-semibold">{request.requestNumber}</strong>.
        </h1>
        <p className="text-body">{TENANT_MESSAGES.onTheBoard}</p>
      </section>

      <SummaryBlock token={token} request={request} />

      <div className="flex flex-col gap-3">
        {resolved.view.kind === "door" && (
          <p className="text-center text-small text-muted">{TENANT_MESSAGES.doorStatusNote}</p>
        )}
        <SaveLinkButton path={`/u/${token}`} />
        <Link
          href={`/u/${token}`}
          className="inline-flex h-12 w-full items-center justify-center rounded-sm px-6 font-medium text-body hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Report something else
        </Link>
      </div>
    </main>
  );
}
