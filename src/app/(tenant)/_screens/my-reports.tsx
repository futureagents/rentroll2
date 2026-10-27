import { EmptyState, Icon, StatusChip, type ChipTone } from "@/components/ui";
import type { MyReportsView, MyReportView, ReportHistoryLine, TenantStatusWord } from "@/server/tenant";

import { ButtonLink, TenantPageFrame } from "./tenant-page";

// T-03 · My reports (/u/:token/reports, D-03). Every request of this tenancy (D-29), each with its
// number, category, date, status chip and the landlord's latest sent update (T03-LST-REPORTS), and
// its history when expanded (T03-TML-ITEM). Words and dates only: the D-30 status words, never a
// vendor, cost, urgency or time of day. The landlord's update is shown exactly as sent (D-17).

export const MY_REPORTS_TITLE = "My reports";

const TONE: Record<TenantStatusWord, ChipTone> = {
  Received: "neutral",
  Assigned: "primary",
  "In progress": "warning",
  Reopened: "warning",
  Done: "success",
};

// A status the tenant cannot act on still says what it means. D-28: nothing notifies the
// landlord, so "Received" says where the landlord will see it, not that they have.
const STATUS_NOTE: Record<TenantStatusWord, string> = {
  Received: "Your landlord will see this on their board.",
  Assigned: "Someone has been asked to fix this.",
  "In progress": "Work on this has started.",
  Reopened: "This is being looked at again.",
  Done: "Your landlord has marked this as fixed. If it is still a problem, report it again.",
};

// PROMOTE: A2 Timeline with calendar dates only. The A2 Timeline prints a time of day and needs a
// row id; tenant history shows the day alone and has no id to give (D-30).
function History({ lines }: { lines: ReportHistoryLine[] }) {
  return (
    <ol className="flex flex-col gap-3 border-l border-line pl-4">
      {lines.map((line, i) => (
        <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-ink">{line.word}</span>
          <span className="text-small text-muted">{line.on}</span>
        </li>
      ))}
    </ol>
  );
}

function Report({ report }: { report: MyReportView }) {
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-h2 text-ink">{report.category}</h2>
          <p className="text-small text-muted">
            {report.requestNumber} · Reported {report.reportedOn}
          </p>
        </div>
        <StatusChip tone={TONE[report.status]}>{report.status}</StatusChip>
      </div>
      <p>{STATUS_NOTE[report.status]}</p>
      {report.latestUpdate && (
        <div className="flex flex-col gap-1 rounded-sm bg-canvas p-3">
          <p className="text-label uppercase text-muted">Latest update from your landlord</p>
          <p className="whitespace-pre-line text-ink">{report.latestUpdate}</p>
        </div>
      )}
      <details className="group">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between rounded-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          What has happened so far
          <Icon name="chevron-down" className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="pt-2">
          <History lines={report.history} />
        </div>
      </details>
    </li>
  );
}

export function MyReportsScreen({ basePath, view }: { basePath: string; view: MyReportsView }) {
  return (
    <TenantPageFrame basePath={basePath} header={view.header} page="reports" title={MY_REPORTS_TITLE}>
      {view.reports.length === 0 ? (
        // E2 (T-03): "You have not reported anything yet." · Report a problem
        <EmptyState message="You have not reported anything yet.">
          <ButtonLink href={basePath}>Report a problem</ButtonLink>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {view.reports.map((report) => (
            <Report key={report.requestNumber} report={report} />
          ))}
        </ul>
      )}
    </TenantPageFrame>
  );
}
