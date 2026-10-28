// L15-SEC-SYSTEM †: the address every tenant link and door QR code is built on (APP_BASE_URL,
// D-01, D-03). Read only: it is deployment configuration, and a printed sticker keeps pointing at
// the old address for as long as it stays on the door.

export function SystemSection({ baseUrl }: { baseUrl: { configured: string | null; effective: string | null } }) {
  return (
    <section
      id="system"
      aria-labelledby="settings-system-heading"
      className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6"
    >
      <header className="flex flex-col gap-1">
        <h2 id="settings-system-heading" className="text-h2 text-ink">
          System
        </h2>
        <p className="text-small text-muted">Set by whoever runs RentRoll for you. Shown here so you can check it.</p>
      </header>

      <dl className="flex flex-col gap-1">
        <dt className="text-label uppercase text-muted">App address (BASE_URL)</dt>
        <dd className="break-all text-body text-ink">
          {baseUrl.configured ?? baseUrl.effective ?? "Not set"}
        </dd>
      </dl>

      {baseUrl.configured ? null : baseUrl.effective ? (
        <p className="rounded-sm border border-warning bg-warning/12 p-3 text-small text-ink">
          Not configured. While you are developing, links use this computer&apos;s own address, which a tenant&apos;s
          phone cannot open. Set APP_BASE_URL before printing any door QR code.
        </p>
      ) : (
        <p className="rounded-sm border border-warning bg-warning/12 p-3 text-small text-ink">
          Not configured, so tenant links and door QR codes cannot be made yet. Ask whoever runs RentRoll to set
          APP_BASE_URL.
        </p>
      )}

      <p className="text-small text-body">
        Every door QR code and tenant link starts with this address. Codes already printed and stuck on doors keep
        pointing at it, so changing it breaks every one of them until you print new cards. It must not be changed
        casually.
      </p>
    </section>
  );
}
