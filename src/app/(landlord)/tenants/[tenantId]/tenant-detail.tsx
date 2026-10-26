"use client";
// L-11 · Tenant detail. L11-SEC-CONTACT, L11-SEC-AGREEMENT (with earlier terms beneath, D-08, and
// L11-BTN-RECORDNOTICE †, D-13), L11-SEC-PAYMENTS (with the paid-on-time percentage and its
// definition in a tooltip), L11-SEC-DOCS (download and share, upload †), L11-BTN-ENDTENANCY
// (D-05 → L-13) and L11-BTN-SENDAGREEMENT.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { PageHeader } from "@/components/shell/page-header";
import {
  Button,
  CopyButton,
  DataTable,
  DateField,
  ShareButton,
  StatusChip,
  ToastProvider,
  Tooltip,
  useToast,
  type Column,
} from "@/components/ui";
import { formatDate, formatMonth, formatPhone, formatRupees } from "@/lib/format";

import { DocumentPicker } from "../../units/_components/document-picker";
import { Modal } from "../../units/_components/modal";
import { noticeDefaults } from "../../units/_lib/forms";
import { STANDING_CHIP } from "../../units/_lib/occupancy";
import { ON_TIME_DEFINITION } from "../../units/_lib/rent";
import { endTenancyAction, recordNoticeAction } from "../actions";
import { ComposerButton } from "./composer-stub";
import type { TenantView, TermView } from "./view";

const card = "flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-1 lg:p-6";

export function TenantDetail({ view }: { view: TenantView }) {
  return (
    <ToastProvider>
      <Detail view={view} />
    </ToastProvider>
  );
}

function Detail({ view }: { view: TenantView }) {
  const [ending, setEnding] = useState(false);
  const [recordingNotice, setRecordingNotice] = useState(false);
  const chip = STANDING_CHIP[view.standing];

  return (
    <>
      <PageHeader
        title={view.name}
        action={
          view.active && (
            <Button variant="danger" onClick={() => setEnding(true)}>
              End tenancy
            </Button>
          )
        }
        filters={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
            <Link href={`/units/${view.unitId}`} className="text-small font-medium text-primary underline-offset-2 hover:underline">
              {view.unitLabel}
            </Link>
            <span className="text-small text-muted">
              Moved in {formatDate(view.movedInOn)}
              {view.endedOn ? ` · moved out ${formatDate(view.endedOn)}` : ""}
            </span>
            <Link
              href="/tenants"
              className="ml-auto inline-flex h-8 items-center rounded-sm px-3 text-small font-medium text-body hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              All tenants
            </Link>
          </div>
        }
      />
      <section className="grid gap-4 p-4 lg:grid-cols-2 lg:p-6">
        <Contact view={view} />
        <Agreement view={view} recording={recordingNotice} onRecord={setRecordingNotice} />
        <Payments view={view} />
        <Documents view={view} />
      </section>
      <EndTenancyDialog view={view} open={ending} onClose={() => setEnding(false)} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// L11-SEC-CONTACT
// ---------------------------------------------------------------------------------------------

function Contact({ view }: { view: TenantView }) {
  return (
    <section aria-labelledby="contact-heading" className={card}>
      <h2 id="contact-heading" className="text-h2 text-ink">
        Contact
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-body text-ink tabular-nums">{formatPhone(view.phone)}</span>
        {/* Tap to call (C-5): dials without copying the number. */}
        <Button variant="icon" icon="call" label={`Call ${view.name}`} onClick={() => (window.location.href = `tel:${view.phone}`)} />
        <ComposerButton variant="icon" icon="note" label={`Message ${view.name}`} request={{ kind: "tenant_message", tenancyId: view.id, channel: "whatsapp" }} />
        <CopyButton text={view.phone} label="Copy phone number" />
      </div>
      {view.email && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-body text-ink">{view.email}</span>
          <ComposerButton variant="icon" icon="share" label={`Email ${view.name}`} request={{ kind: "tenant_message", tenancyId: view.id, channel: "email" }} />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// L11-SEC-AGREEMENT and L11-BTN-RECORDNOTICE †
// ---------------------------------------------------------------------------------------------

function termLine(t: TermView): string {
  return `${formatDate(t.startsOn)} – ${formatDate(t.endsOn)} · ${formatRupees(t.rent)} a month, due on day ${t.rentDueDay}`;
}

function Agreement({ view, recording, onRecord }: { view: TenantView; recording: boolean; onRecord: (open: boolean) => void }) {
  const notice =
    view.noticeVacateOn && view.noticeGivenOn
      ? `Notice given ${formatDate(view.noticeGivenOn)}, vacating ${formatDate(view.noticeVacateOn)}`
      : "No notice recorded";

  return (
    <section aria-labelledby="agreement-heading" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="agreement-heading" className="text-h2 text-ink">
          Agreement
        </h2>
        {view.countdown && <StatusChip tone={view.countdown.tone}>{view.countdown.label}</StatusChip>}
      </div>
      {view.current ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-label uppercase text-muted">Start</dt>
          <dd>{formatDate(view.current.startsOn)}</dd>
          <dt className="text-label uppercase text-muted">End</dt>
          <dd>{formatDate(view.current.endsOn)}</dd>
          <dt className="text-label uppercase text-muted">Rent</dt>
          <dd>
            {formatRupees(view.current.rent)} <span className="text-small text-muted">due on day {view.current.rentDueDay}</span>
          </dd>
          <dt className="text-label uppercase text-muted">Deposit paid</dt>
          <dd>
            {formatRupees(view.depositPaid)}
            {view.depositReceivedOn && <span className="text-small text-muted"> received {formatDate(view.depositReceivedOn)}</span>}
          </dd>
          <dt className="text-label uppercase text-muted">Notice</dt>
          <dd>{notice}</dd>
        </dl>
      ) : (
        <p className="text-body">No agreement is recorded for this tenancy.</p>
      )}

      {view.upcoming.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-label uppercase text-muted">Renewal recorded</h3>
          <ul className="flex flex-col gap-1 text-small text-body">
            {view.upcoming.map((t) => (
              <li key={t.id}>{termLine(t)}</li>
            ))}
          </ul>
        </div>
      )}
      {view.earlier.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-label uppercase text-muted">Earlier terms</h3>
          <ul className="flex flex-col gap-1 text-small text-body">
            {view.earlier.map((t) => (
              <li key={t.id}>{termLine(t)}</li>
            ))}
          </ul>
        </div>
      )}

      {view.active &&
        (recording ? (
          <NoticeForm view={view} onDone={() => onRecord(false)} />
        ) : (
          <Button variant="secondary" size={32} className="self-start" onClick={() => onRecord(true)}>
            {view.noticeVacateOn ? "Change notice" : "Record notice"}
          </Button>
        ))}

      {/* L11-BTN-SENDAGREEMENT: opens S-01 with the agreement referenced. */}
      {view.current && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <span className="self-start">
            <ComposerButton
              variant="quiet"
              size={32}
              label="Send agreement by email"
              request={{ kind: "agreement_email", tenancyId: view.id, agreementId: view.current.id }}
            />
          </span>
          <p className="text-small text-muted">Attach the file after your email app opens.</p>
        </div>
      )}
    </section>
  );
}

function NoticeForm({ view, onDone }: { view: TenantView; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const defaults = noticeDefaults(view.today);
  const [givenOn, setGivenOn] = useState(view.noticeGivenOn ?? defaults.givenOn);
  const [vacateOn, setVacateOn] = useState(view.noticeVacateOn ?? defaults.vacateOn);
  const [errors, setErrors] = useState<{ givenOn?: string; vacateOn?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await recordNoticeAction(view.id, view.unitId, givenOn, vacateOn);
      if (result.ok) {
        toast.show({ message: "Notice recorded." });
        onDone();
        router.refresh();
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.error);
    });

  return (
    <form
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-3 rounded-sm border border-line bg-canvas p-3"
    >
      <h3 id={`${id}-title`} className="text-body font-medium text-ink">
        Record notice
      </h3>
      {formError && (
        <p role="alert" className="text-small text-danger">
          {formError}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField label="Notice given on" required value={givenOn} onChange={setGivenOn} error={errors.givenOn} />
        <DateField label="Vacating on" required value={vacateOn} onChange={setVacateOn} error={errors.vacateOn} />
      </div>
      <p className="text-small text-muted">Recording notice does not end the agreement or stop rent. End the tenancy on the day they leave.</p>
      <div className="flex justify-end gap-2">
        {pending ? (
          <Button variant="quiet" size={32} disabled disabledReason="Saving the notice">
            Cancel
          </Button>
        ) : (
          <Button variant="quiet" size={32} onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" size={32} variant="secondary" loading={pending}>
          Save notice
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
// L11-SEC-PAYMENTS
// ---------------------------------------------------------------------------------------------

type PaymentRow = TenantView["payments"][number];

function Payments({ view }: { view: TenantView }) {
  const tooltipId = useId();
  const { percent, onTime, counted } = view.onTime;
  const columns: Column<PaymentRow>[] = [
    { id: "month", header: "Month", cell: (r) => formatMonth(r.month), sortValue: (r) => r.month },
    { id: "due", header: "Due on", key: true, cell: (r) => formatDate(r.dueOn), sortValue: (r) => r.dueOn },
    {
      id: "amount",
      header: "Rent due",
      align: "right",
      key: true,
      cell: (r) => (
        <>
          {formatRupees(r.amountDue)}
          {r.isProRata && <span className="block text-small text-muted">Part month</span>}
        </>
      ),
      sortValue: (r) => r.amountDue,
    },
    {
      id: "paid",
      header: "Paid",
      align: "right",
      key: true,
      cell: (r) => (
        <span className="flex flex-col items-end py-1">
          {formatRupees(r.paid)}
          {r.receipts.map((p) => (
            <span key={p.number} className="text-small text-muted">
              {p.number} · {formatDate(p.receivedOn)}
            </span>
          ))}
        </span>
      ),
      sortValue: (r) => r.paid,
    },
    {
      id: "status",
      header: "Status",
      key: true,
      cell: (r) => (
        <span className="flex flex-col items-start gap-1 py-1">
          <StatusChip tone={r.chip.tone}>{r.chip.label}</StatusChip>
          {r.chip.sub && <span className="text-small text-muted">{r.chip.sub}</span>}
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="payments-heading" className={`${card} lg:col-span-2`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="payments-heading" className="text-h2 text-ink">
          Rent payments
        </h2>
        <div className="flex flex-col items-end gap-1">
          <Tooltip id={tooltipId} label={ON_TIME_DEFINITION} side="bottom">
            <button
              type="button"
              aria-describedby={tooltipId}
              className="inline-flex items-center gap-2 rounded-sm text-label uppercase text-muted underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Paid on time
            </button>
          </Tooltip>
          <span className="text-display text-ink tabular-nums">{percent === null ? "—" : `${percent}%`}</span>
          <span className="text-small text-muted">
            {counted === 0 ? "No rent has fallen due yet" : `${onTime} of ${counted} ${counted === 1 ? "month" : "months"}`}
          </span>
        </div>
      </div>
      <DataTable
        caption={`Rent payments for ${view.name}`}
        columns={columns}
        rows={view.payments}
        rowKey={(r) => r.id}
        mobileTitle={(r) => formatMonth(r.month)}
        empty={{ message: "Rent entries appear here from the first month of the tenancy." }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// L11-SEC-DOCS
// ---------------------------------------------------------------------------------------------

function Documents({ view }: { view: TenantView }) {
  return (
    <section aria-labelledby="docs-heading" className={`${card} lg:col-span-2`}>
      <h2 id="docs-heading" className="text-h2 text-ink">
        Documents
      </h2>
      {view.documents.length === 0 ? (
        <p className="text-body text-muted">The agreement, ID proof and move-in photos for this tenancy appear here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {view.documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{doc.typeLabel}</span>
                <span className="block truncate text-small text-muted">
                  {doc.fileName} · {formatDate(doc.uploadedOn)}
                </span>
              </span>
              {doc.url ? (
                <>
                  <a href={doc.url} className="text-small font-medium text-primary underline-offset-2 hover:underline">
                    Download
                  </a>
                  {/* S-03: the link is signed and lasts an hour (D-15). */}
                  <ShareButton url={doc.url} title={`${doc.typeLabel} · ${view.name}`} label={`Share ${doc.typeLabel.toLowerCase()}`} />
                </>
              ) : (
                <span className="text-small text-muted">Unavailable</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {view.documents.length > 0 && <p className="text-small text-muted">Shared links stop working after an hour.</p>}
      <DocumentPicker tenancyId={view.id} unitId={view.unitId} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// L11-BTN-ENDTENANCY → confirm dialog → L-13 (D-05)
// ---------------------------------------------------------------------------------------------

function EndTenancyDialog({ view, open, onClose }: { view: TenantView; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [endedOn, setEndedOn] = useState(view.today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await endTenancyAction(view.id, view.unitId, endedOn);
      if (!result.ok) {
        setError(result.fieldErrors?.endedOn ?? result.error);
        return;
      }
      // "routes to L-13 with this tenant selected" (L11-BTN-ENDTENANCY, D-05).
      router.push(`/deposits/${view.id}`);
    });

  return (
    <Modal
      open={open}
      title={`End ${view.name}'s tenancy?`}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          {pending ? (
            <Button variant="quiet" disabled disabledReason="Ending the tenancy">
              Cancel
            </Button>
          ) : (
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button variant="danger" loading={pending} onClick={confirm}>
            End tenancy
          </Button>
        </>
      }
    >
      <p className="text-body">
        Their tenant link stops working, no more rent is created and {view.unitLabel} shows as vacant. Next you settle the deposit.
      </p>
      <DateField label="Move-out date" required value={endedOn} onChange={setEndedOn} error={error} max={view.today} />
    </Modal>
  );
}
