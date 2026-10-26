// Development-only preview of T-01 and T-02 with fixture data, at /dev/tenant (never built: see
// next.config.ts). `?view=door` shows the door-sticker variant; `?screen=t02` shows T-02. Submit
// posts to the real action with a token that does not resolve, so it shows E1-10.
import { ReportForm } from "@/app/(tenant)/u/[token]/report-form";
import { TenantHeaderBlock } from "@/app/(tenant)/u/[token]/tenant-header";
import { SaveLinkButton } from "@/app/(tenant)/u/[token]/reported/[requestNumber]/save-link";
import { SummaryBlock } from "@/app/(tenant)/u/[token]/reported/[requestNumber]/summary-block";
import { Icon } from "@/components/ui";
import { TENANT_MESSAGES } from "@/lib/tenant/report";

const header = {
  unitLabel: "Flat 2A",
  propertyName: "Kulkarni Apartments",
  landlordName: "Anil Kulkarni",
  landlordPhone: "+919000000101",
};
const token = "0".repeat(40);

export default async function TenantPreview({ searchParams }: { searchParams: Promise<{ view?: string; screen?: string }> }) {
  const { view, screen } = await searchParams;
  const door = view === "door";
  if (screen === "t02") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:py-8">
        <section className="flex flex-col items-center gap-3 pt-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-success/12 text-success">
            <Icon name="check" size={24} />
          </span>
          <h1 className="text-h1 text-ink">
            Reported. Your request number is <strong className="font-semibold">R-0412</strong>.
          </h1>
          <p className="text-body">{TENANT_MESSAGES.onTheBoard}</p>
        </section>
        <SummaryBlock
          token={token}
          request={{ requestNumber: "R-0412", category: "Plumbing", reportedOn: "26 Oct 2026", status: "Received", photoCount: 2 }}
        />
        <div className="flex flex-col gap-3">
          {door && <p className="text-center text-small text-muted">{TENANT_MESSAGES.doorStatusNote}</p>}
          <SaveLinkButton path={`/u/${token}`} />
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:py-8">
      <TenantHeaderBlock header={header} />
      <ReportForm token={token} prefill={door ? null : { name: "Priya Deshpande", phone: "9000000303" }} stamp="preview" />
      <a
        href={`tel:${header.landlordPhone}`}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface px-6 font-medium text-body hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Call the landlord
      </a>
    </main>
  );
}
