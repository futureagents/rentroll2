import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderStamp, resolveTenantToken } from "@/server/tenant";

import { ReportForm } from "./report-form";
import { TenantHeaderBlock } from "./tenant-header";

// T-01 · Report a problem, the entry point (/u/:token, D-03). Both token kinds land here (D-01).
// The token is resolved before anything renders; any failure is E1-10 (not-found.tsx under /u).
//
// Not rendered yet: T01-LNK-MYREPORTS and the D-03 footer links (T-03, T-04, T-05 do not exist
// in this build; a link to them would show a tenant the invalid-link message). They arrive with
// those screens, tenant link only (D-02).

export const metadata: Metadata = { title: "Report a problem" };

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveTenantToken(token);
  if (!resolved) notFound();
  const { view } = resolved;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:py-8">
      <TenantHeaderBlock header={view.header} />
      <ReportForm
        token={token}
        prefill={view.kind === "tenant" ? view.prefill : null}
        stamp={renderStamp(token)}
      />
      {/* T01-BTN-CALL: "always visible, below the form. Some things need a phone call." */}
      {view.header.landlordPhone && (
        <a
          href={`tel:${view.header.landlordPhone}`}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface px-6 font-medium text-body hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Call the landlord
        </a>
      )}
    </main>
  );
}
