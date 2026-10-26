import type { TenantHeader } from "@/server/tenant";

// T01-HDR: "Landlord's name or logo · 'Flat 2A, Kulkarni Apartments' · nothing else", so the
// tenant knows they have the right link. Name only: tenant pages fetch no files (D-15), so the
// logo is not shown.
export function TenantHeaderBlock({ header }: { header: TenantHeader }) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-small text-muted">{header.landlordName}</p>
      <h1 className="text-h1 text-ink">
        {header.unitLabel}, {header.propertyName}
      </h1>
    </header>
  );
}
