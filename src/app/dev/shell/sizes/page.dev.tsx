// Development-only: /dev/shell at the three A4 bands side by side, so the breakpoints can
// be checked without resizing the window. 390px (under 640), 800px (640–1024), 1200px (over).
const SIZES = [
  { label: "Under 640px · bottom bar, stacked cards, stats two per row", width: 390 },
  { label: "640–1024px · icon sidebar, panel over content", width: 800 },
  { label: "Over 1024px · full sidebar, panel alongside", width: 1200 },
];

export default function DevShellSizesPage() {
  return (
    <main className="flex flex-col gap-6 p-6">
      {SIZES.map(({ label, width }) => (
        <section key={width} className="flex flex-col gap-2">
          <h2 className="text-h2 text-ink">{label}</h2>
          <iframe
            title={label}
            src="/dev/shell"
            width={width}
            height={720}
            className="shrink-0 rounded-md border border-line bg-surface"
          />
        </section>
      ))}
    </main>
  );
}
