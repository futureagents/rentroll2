import type { ReactNode } from "react";

import { Icon } from "@/components/ui";
import { formatPhone } from "@/lib/format";
import type { MyUnitView } from "@/server/tenant";

import { ButtonLink, TenantPageFrame } from "./tenant-page";

// T-04 · My unit (/u/:token/unit, D-03). Unit, property, landlord and the agreement's start and end
// dates (T04-SEC-UNIT), and two ways to reach the landlord (T04-BTN-CALL, T04-BTN-MESSAGE).
// No rent figure: the view carries none, and none is read (T-04 note, G-2).

export const MY_UNIT_TITLE = "My unit";

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-label uppercase text-muted">{term}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

export function MyUnitScreen({ basePath, view }: { basePath: string; view: MyUnitView }) {
  const { header, agreement } = view;
  const phone = header.landlordPhone;
  return (
    <TenantPageFrame basePath={basePath} header={header} page="unit" title={MY_UNIT_TITLE}>
      <section aria-label="Your unit" className="rounded-md border border-line bg-surface p-4 shadow-1">
        <dl className="flex flex-col divide-y divide-line">
          <Row term="Unit">{header.unitLabel}</Row>
          <Row term="Building">{header.propertyName}</Row>
          <Row term="Landlord">{header.landlordName}</Row>
          {phone && <Row term="Landlord's phone">{formatPhone(phone)}</Row>}
          {agreement ? (
            <>
              <Row term="Agreement starts">{agreement.startsOn}</Row>
              <Row term="Agreement ends">{agreement.endsOn}</Row>
            </>
          ) : (
            <Row term="Agreement dates">Your landlord has not added these yet. Ask them if you need them.</Row>
          )}
        </dl>
      </section>
      {phone ? (
        <div className="flex flex-col gap-3">
          <ButtonLink href={`tel:${phone}`}>
            <Icon name="call" />
            Call the landlord
          </ButtonLink>
          {/* T04-BTN-MESSAGE: WhatsApp with a blank message. Tenant code sends nothing (G-1). */}
          <ButtonLink href={`https://wa.me/${phone.replace(/\D/g, "")}`} variant="secondary" target="_blank" rel="noopener noreferrer">
            Message on WhatsApp
          </ButtonLink>
        </div>
      ) : (
        <p className="text-small text-muted">Your landlord has not added a phone number yet.</p>
      )}
    </TenantPageFrame>
  );
}
