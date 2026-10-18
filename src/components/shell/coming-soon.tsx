import { PageHeader } from "./page-header";

// Placeholder body for landlord screens whose lane has not landed yet. Rendered inside the
// shell so navigation, active state and the page header can be exercised end to end.
export function ComingSoon({ title, screen }: { title: string; screen: string }) {
  return (
    <>
      <PageHeader title={title} />
      <section className="p-4 lg:p-6">
        <div className="rounded-md border border-line bg-surface p-6 shadow-1">
          <h2 className="text-h2 text-ink">Coming soon</h2>
          <p className="mt-2 text-small text-muted">
            {title} ({screen}) is being built and will appear here.
          </p>
        </div>
      </section>
    </>
  );
}
