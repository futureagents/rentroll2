import type { ReactNode } from "react";

// L-01 route group: /signin, /signup, /reset. Public, no app shell (A3: L-01 has no sidebar
// entry; "This screen is not a marketing page"). One centred card on the canvas.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="mb-4 text-center text-h2 text-ink">RentRoll</p>
        <section className="rounded-md bg-surface p-6 shadow-1">{children}</section>
      </div>
    </main>
  );
}
