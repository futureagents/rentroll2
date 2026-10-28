// L-15 page load (E3): skeleton shapes matching the real layout, never a centred spinner.
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8" aria-busy="true" aria-label="Loading settings">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-32 animate-pulse rounded-sm bg-line" />
        <div className="h-4 w-64 animate-pulse rounded-sm bg-line" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-6 w-20 animate-pulse rounded-sm bg-line" />
        ))}
      </div>
      <div className="flex max-w-3xl flex-col gap-6">
        {[3, 4, 3, 2].map((fields, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6">
            <div className="h-5 w-40 animate-pulse rounded-sm bg-line" />
            {Array.from({ length: fields }, (_, j) => (
              <div key={j} className="flex max-w-md flex-col gap-2">
                <div className="h-3 w-24 animate-pulse rounded-sm bg-line" />
                <div className="h-10 animate-pulse rounded-sm bg-line" />
              </div>
            ))}
            <div className="h-10 w-40 animate-pulse rounded-sm bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
