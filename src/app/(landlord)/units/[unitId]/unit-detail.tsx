"use client";
// L-09 · Unit detail. Header with unit identity and status (the L08-CHP-STATUS chip, proposed
// decision), then four tabs: Overview · Rent history · Maintenance history · Photos & documents.
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button, CopyButton, ShareButton, StatCard, StatusChip, ToastProvider } from "@/components/ui";
import { formatDate, formatPhone, formatRupees, formatRupeesShort } from "@/lib/format";

import { Tabs } from "../_components/tabs";
import { NO_PHOTOS_CONSEQUENCE } from "../_lib/forms";
import { OCCUPANCY_CHIP } from "../_lib/occupancy";
import { AddTenantPanel } from "./add-tenant-panel";
import { EditUnitPanel } from "./edit-unit-panel";
import { MaintenanceTab, RentTab } from "./history-tabs";
import { PhotosTab } from "./photos-tab";
import { QrModal } from "./qr-modal";
import type { UnitView } from "./view";

type TabValue = "overview" | "rent" | "maintenance" | "photos";

export function UnitDetail({ view }: { view: UnitView }) {
  const [tab, setTab] = useState<TabValue>("overview");
  const [addingTenant, setAddingTenant] = useState(false);
  const [editing, setEditing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const chip = OCCUPANCY_CHIP[view.occupancy];
  const vacant = view.current === null;

  return (
    <ToastProvider>
      <PageHeader
        title={view.label}
        action={
          // L09-BTN-ADDTENANT: "Visible only when vacant" — no active tenancy (D-05).
          vacant && (
            <Button icon="plus" onClick={() => setAddingTenant(true)}>
              Add tenant
            </Button>
          )
        }
        filters={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
            {view.type && <span className="text-small text-body">{view.type}</span>}
            <span className="text-small text-muted">{view.propertyAddress}</span>
            <span className="ml-auto flex gap-2">
              <Link
                href="/units"
                className="inline-flex h-8 items-center rounded-sm px-3 text-small font-medium text-body hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                All units
              </Link>
              <Button variant="secondary" size={32} onClick={() => setEditing(true)}>
                Edit unit
              </Button>
            </span>
          </div>
        }
      />
      <section className="p-4 lg:p-6">
        <Tabs<TabValue>
          label={`${view.label} sections`}
          value={tab}
          onChange={setTab}
          items={[
            { value: "overview", label: "Overview", panel: <Overview view={view} onShowQr={() => setQrOpen(true)} onShowPhotos={() => setTab("photos")} /> },
            { value: "rent", label: "Rent history", panel: <RentTab rows={view.rentRows} /> },
            { value: "maintenance", label: "Maintenance history", panel: <MaintenanceTab requests={view.requests} notes={view.repeatNotes} /> },
            { value: "photos", label: "Photos & documents", panel: <PhotosTab view={view} /> },
          ]}
        />
      </section>
      <AddTenantPanel view={view} open={addingTenant} onClose={() => setAddingTenant(false)} />
      <EditUnitPanel view={view} open={editing} onClose={() => setEditing(false)} />
      <QrModal view={view} open={qrOpen} onClose={() => setQrOpen(false)} />
    </ToastProvider>
  );
}

// ---------------------------------------------------------------------------------------------
// L09-TAB-OVERVIEW
// ---------------------------------------------------------------------------------------------

const card = "flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6";

function Overview({ view, onShowQr, onShowPhotos }: { view: UnitView; onShowQr: () => void; onShowPhotos: () => void }) {
  const { lifetime, lastTwelveMonths } = view.figures;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${view.propertyName}, ${view.propertyAddress}`)}`;

  return (
    <div className="flex flex-col gap-6">
      {/* The quiet insight: what this one unit has earned and cost, over its whole life (L-09). */}
      <section aria-labelledby="lifetime-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="lifetime-heading" className="text-h2 text-ink">
            What this unit has earned
          </h2>
          <p className="text-small text-muted">
            {view.historySince
              ? `Every tenant since ${formatDate(view.historySince)}. Rent counts when it was received; repairs count when they were marked done.`
              : "Figures appear once a tenant moves in and rent is recorded."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:gap-4">
          <StatCard
            label="Rent collected"
            value={formatRupeesShort(lifetime.collected)}
            comparison={`${formatRupees(lastTwelveMonths.collected)} in the last 12 months`}
          />
          <StatCard
            label="Maintenance spend"
            value={formatRupeesShort(lifetime.spend)}
            comparison={`${formatRupees(lastTwelveMonths.spend)} in the last 12 months`}
          />
          <StatCard
            label="Net"
            value={formatRupeesShort(lifetime.net)}
            tone={lifetime.net < 0 ? "danger" : "ink"}
            comparison={`${formatRupees(lastTwelveMonths.net)} in the last 12 months`}
          />
        </div>
        {(lastTwelveMonths.collected > 0 || lastTwelveMonths.spend > 0) && (
          <p className="text-body text-ink">
            In the last 12 months this unit earned {formatRupees(lastTwelveMonths.collected)} and cost{" "}
            {formatRupees(lastTwelveMonths.spend)}.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="tenant-heading" className={card}>
          <h2 id="tenant-heading" className="text-h2 text-ink">
            Current tenant
          </h2>
          {view.current ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-label uppercase text-muted">Name</dt>
              <dd>
                <Link href={`/tenants/${view.current.tenancyId}`} className="font-medium text-primary underline-offset-2 hover:underline">
                  {view.current.name}
                </Link>
              </dd>
              <dt className="text-label uppercase text-muted">Phone</dt>
              <dd>{formatPhone(view.current.phone)}</dd>
              <dt className="text-label uppercase text-muted">Moved in</dt>
              <dd>{formatDate(view.current.movedInOn)}</dd>
              {view.current.agreementEndsOn && (
                <>
                  <dt className="text-label uppercase text-muted">Agreement ends</dt>
                  <dd>{formatDate(view.current.agreementEndsOn)}</dd>
                </>
              )}
              {view.current.noticeVacateOn && (
                <>
                  <dt className="text-label uppercase text-muted">Vacating on</dt>
                  <dd>{formatDate(view.current.noticeVacateOn)}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-body">No one lives here right now. Add a tenant when someone moves in.</p>
          )}
          {view.current && view.current.moveInPhotoCount === 0 && (
            <p className="rounded-sm bg-warning/12 px-3 py-2 text-small text-ink">
              No move-in photos for this tenancy. {NO_PHOTOS_CONSEQUENCE}{" "}
              <button type="button" onClick={onShowPhotos} className="font-medium text-primary underline underline-offset-2">
                Add photos
              </button>
            </p>
          )}
        </section>

        <section aria-labelledby="money-heading" className={card}>
          <h2 id="money-heading" className="text-h2 text-ink">
            Rent and deposit
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-label uppercase text-muted">Rent</dt>
            <dd>
              {formatRupees(view.rent)}{" "}
              <span className="text-small text-muted">{view.current ? "current agreement" : "asking rent"}</span>
            </dd>
            <dt className="text-label uppercase text-muted">Deposit</dt>
            <dd>
              {formatRupees(view.askingDeposit)} <span className="text-small text-muted">asking deposit</span>
            </dd>
            {view.current && (
              <>
                <dt className="text-label uppercase text-muted">Deposit held</dt>
                <dd>{formatRupees(view.current.depositPaid)}</dd>
              </>
            )}
          </dl>
        </section>

        <section aria-labelledby="link-heading" className={card}>
          <h2 id="link-heading" className="text-h2 text-ink">
            Tenant link
          </h2>
          {view.current ? (
            <>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-sm bg-canvas px-2 py-1 text-small text-body" title={view.current.tenantLink}>
                  {view.current.tenantLink}
                </code>
                {/* L09-BTN-COPYLINK, L09-BTN-SHARELINK (S-03). The tenant's own link, D-01. */}
                <CopyButton text={view.current.tenantLink} label="Copy tenant link" />
                <ShareButton
                  url={view.current.tenantLink}
                  title={view.label}
                  text={`Your link for ${view.label}: report a problem, see your receipts and your landlord's contact.`}
                  label="Share tenant link"
                />
              </div>
              <p className="text-small text-muted">
                Send this to {view.current.name}. It opens their reports, receipts and unit page, and stops working when the tenancy ends.
              </p>
            </>
          ) : (
            <p className="text-body">A tenant link is created when you add a tenant.</p>
          )}
        </section>

        <section aria-labelledby="door-heading" className={card}>
          <h2 id="door-heading" className="text-h2 text-ink">
            Door QR code and location
          </h2>
          <div className="flex flex-wrap gap-2">
            {/* L09-BTN-QR. The A2 icon set has no QR or map glyph, so these are labelled buttons. */}
            <Button variant="secondary" onClick={onShowQr}>
              Show door QR code
            </Button>
            {/* L09-BTN-MAP: the property address in Maps, new tab. */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-sm border border-primary bg-surface px-4 font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Open in Maps
            </a>
          </div>
          {/* D-02 helper under L09-BTN-QR. */}
          <p className="text-small text-muted">
            The door code is for reporting problems only and stays the same between tenants. Share the tenant link for everything else.
          </p>
        </section>
      </div>
    </div>
  );
}
