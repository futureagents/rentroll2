"use client";
// L-07 · Request detail panel. "Everything about one reported problem, and every action needed
// to close it." Opens over (or, over 1024px, alongside) L-06.
//
// L-07 rule: "Never expose to the tenant: the vendor's rate, the cost recorded, internal notes,
// or any other unit. The tenant update draft is built from status and category only." This
// panel is landlord-only; the only things that reach a tenant are messages the landlord sends
// from S-01 (G-1), which this panel opens and never bypasses. The cost reaches a tenant only
// inside a payment request the landlord sends (D-27).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SidePanel } from "@/components/shell/detail-panel-host";
import {
  Button,
  Dropdown,
  MoneyField,
  PhotoUploader,
  StatusChip,
  TextField,
  Timeline,
  useToast,
} from "@/components/ui";
import { formatDate, formatRupees } from "@/lib/format";

import { addNote, saveRequest } from "../actions";
import { URGENCY_RANK } from "../_lib/board";
import {
  paymentRequestDraft,
  repairPaymentNote,
  tenantUpdateDraft,
  vendorDispatchDraft,
  type TenantUpdateInput,
} from "../_lib/drafts";
import { requestHistory } from "../_lib/history";
import { CLOSE_NEEDS_COST_MESSAGE, closeError, reopenTarget } from "../_lib/lifecycle";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  REPORTED_VIA_LABEL,
  REQUEST_STATUSES,
  STATUS_LABEL,
  URGENCIES,
  URGENCY_LABEL,
  URGENCY_TONE,
  type Category,
  type RequestStatus,
  type Urgency,
  type VendorOption,
} from "../_lib/model";
import type { RequestDetail } from "../_server/queries";
import { ComposerStub, type ComposerTarget } from "./composer-stub";
import { Checkbox, Modal } from "./local-ui";
import { PaymentSheet, type PaymentSheetRequest } from "./payment-sheet";
import { usePhotoUpload } from "./use-photo-upload";
import { VendorField } from "./vendor-field";

/** `close`: arrived by dragging a card to Done (D-22). `tenant_update`: from the L-06 toast (D-36). */
export type PanelIntent = "close" | "tenant_update" | undefined;

type StatusChoice = RequestStatus | "reopen";

interface Form {
  statusChoice: StatusChoice;
  category: Category;
  urgency: Urgency;
  vendorId: string | null;
  cost: number | null;
  noCost: boolean;
  tenantLiable: boolean;
}

function savedForm(detail: RequestDetail): Form {
  return {
    statusChoice: detail.status,
    category: detail.category,
    urgency: detail.urgency,
    vendorId: detail.vendorId,
    cost: detail.cost,
    noCost: detail.noCost,
    tenantLiable: detail.tenantLiable,
  };
}

/** T-01 shows `other` as "Something else" (D-33); the report section quotes the tenant's words. */
function reportedCategoryLabel(category: Category): string {
  return category === "other" ? "Something else" : CATEGORY_LABEL[category];
}

export function RequestPanel({
  detail,
  intent,
  onClose,
}: {
  detail: RequestDetail | null;
  intent: PanelIntent;
  onClose: () => void;
}) {
  if (!detail) {
    return (
      <SidePanel open title="Not found" onClose={onClose}>
        <p>This request is not on your account.</p>
      </SidePanel>
    );
  }
  return <RequestDetailPanel detail={detail} intent={intent} onClose={onClose} />;
}

function RequestDetailPanel({ detail, intent, onClose }: { detail: RequestDetail; intent: PanelIntent; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const unitLabel = `Flat ${detail.unitNumber}`;

  const tenantUpdate = (input: TenantUpdateInput): ComposerTarget | null =>
    detail.tenant
      ? {
          kind: "tenant_update",
          title: `Message to ${detail.tenant.name} · ${unitLabel}`,
          // Status and category only (L-07 rule, D-37) — never cost, vendor or vendor rate.
          draft: tenantUpdateDraft({ status: input.status, category: input.category }),
        }
      : null;

  const initialForm = (): Form => {
    const form = savedForm(detail);
    // D-22: dragged to Done → the dropdown is set to Done and focus goes to the cost.
    if (intent === "close" && detail.status !== "done") form.statusChoice = "done";
    return form;
  };

  const [form, setForm] = useState<Form>(initialForm);
  const [savedVersion, setSavedVersion] = useState(detail.version);
  const [composer, setComposer] = useState<ComposerTarget | null>(() =>
    intent === "tenant_update" ? tenantUpdate({ status: detail.status, category: detail.category }) : null,
  );
  const [sheet, setSheet] = useState<PaymentSheetRequest | null>(null);
  const [addedVendors, setAddedVendors] = useState<VendorOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);
  const [closedPrompt, setClosedPrompt] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState<{ url: string; alt: string } | null>(null);
  const [afterError, setAfterError] = useState<string | null>(null);
  const after = usePhotoUpload();

  // A save refreshes the server data; reset the form to what is now stored.
  if (detail.version !== savedVersion) {
    setSavedVersion(detail.version);
    setForm(savedForm(detail));
  }

  const vendors = [...detail.vendors, ...addedVendors.filter((a) => !detail.vendors.some((v) => v.id === a.id))];
  const savedVendor = vendors.find((v) => v.id === detail.vendorId) ?? null;
  const status: RequestStatus = form.statusChoice === "reopen" ? reopenTarget(form.vendorId) : form.statusChoice;
  const saved = savedForm(detail);
  const dirty = (Object.keys(saved) as (keyof Form)[]).some((key) => saved[key] !== form[key]);
  const beforePhotos = detail.photos.filter((p) => p.kind === "before");
  const afterPhotos = detail.photos.filter((p) => p.kind === "after");
  const history = requestHistory(
    { created_at: detail.createdAt, reported_via: detail.reportedVia },
    detail.audits,
    detail.messages,
  );

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  const openComposer = (target: ComposerTarget | null) => {
    if (target) setComposer(target);
  };

  const closeComposer = () => {
    setComposer(null);
    if (intent) router.replace(`/maintenance/${detail.id}`, { scroll: false });
  };

  const save = async () => {
    setSaveError(null);
    setCostError(null);
    if (status === "done" && detail.status !== "done") {
      const problem = closeError(form.noCost ? null : form.cost, form.noCost);
      if (problem) {
        setCostError(problem);
        return;
      }
    }
    setSaving(true);
    const result = await saveRequest({
      requestId: detail.id,
      status,
      category: form.category,
      urgency: form.urgency,
      vendorId: form.vendorId,
      cost: form.noCost ? null : form.cost,
      noCost: form.noCost,
      tenantLiable: form.tenantLiable,
    });
    setSaving(false);
    if (!result.ok) {
      if (result.error === CLOSE_NEEDS_COST_MESSAGE) setCostError(result.error);
      else setSaveError(result.error);
      return;
    }
    if (intent === "close") router.replace(`/maintenance/${detail.id}`, { scroll: false });
    const savedStatus = result.status;
    const savedCategory = form.category;
    // L-07 "Status set to Done … prompts to add an after photo · offers to notify the tenant" (D-22, D-36).
    if (result.closed) setClosedPrompt(true);
    if (result.closed || result.reopened || savedStatus !== detail.status) {
      toast.show({
        message: result.closed
          ? `${detail.requestNumber} closed.`
          : result.reopened
            ? `${detail.requestNumber} reopened — back in ${STATUS_LABEL[savedStatus]}.`
            : `${detail.requestNumber} moved to ${STATUS_LABEL[savedStatus]}.`,
        undo: detail.tenant
          ? { label: "Update the tenant", onUndo: () => openComposer(tenantUpdate({ status: savedStatus, category: savedCategory })) }
          : undefined,
      });
    } else {
      toast.show({ message: "Saved." });
    }
  };

  const dispatch = () => {
    if (!savedVendor) return;
    openComposer({
      kind: "vendor_dispatch",
      // L07-BTN-DISPATCH: "Recipient defaults to the vendor's number, not the tenant's."
      title: `Message to ${savedVendor.name}`,
      draft: vendorDispatchDraft({
        vendorName: savedVendor.name,
        category: detail.category,
        description: detail.description,
        unitNumber: detail.unitNumber,
        propertyName: detail.propertyName,
        propertyAddress: detail.propertyAddress,
        tenantPhone: detail.tenant?.phone ?? null,
        tenantName: detail.tenant?.name ?? null,
      }),
    });
  };

  const sendPaymentLink = (link: string, amount: number) => {
    if (!detail.tenant) return;
    setSheet(null);
    openComposer({
      kind: "payment_link",
      title: `Message to ${detail.tenant.name} · ${unitLabel}`,
      draft: paymentRequestDraft(detail.category, amount, link),
    });
  };

  const submitNote = async () => {
    setNoteSaving(true);
    setNoteError(null);
    const result = await addNote(detail.id, note);
    setNoteSaving(false);
    if (!result.ok) {
      setNoteError(result.error);
      return;
    }
    setNote("");
  };

  const addAfterPhotos = async (files: File[]) => {
    setAfterError(null);
    const entries = after.add(files, "Photo after the repair");
    const problem = await after.upload(detail.id, "after", entries);
    if (problem) setAfterError(problem);
    else {
      after.clear();
      setClosedPrompt(false);
    }
  };

  // D-21: the effective urgency can be raised above what the tenant reported, never lowered below it.
  const urgencyOptions = URGENCIES.filter((u) => URGENCY_RANK[u] <= URGENCY_RANK[detail.reportedUrgency]).map((u) => ({
    value: u,
    label: URGENCY_LABEL[u],
  }));
  const statusOptions =
    detail.status === "done"
      ? [
          { value: "done", label: STATUS_LABEL.done },
          { value: "reopen", label: `Reopen — back to ${STATUS_LABEL[reopenTarget(form.vendorId)]}` },
        ]
      : REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

  const reporter = detail.reporterName ?? detail.tenant?.name ?? null;
  const vendorUnsaved = form.vendorId !== detail.vendorId;

  return (
    <>
      <SidePanel
        open
        onClose={onClose}
        dirty={dirty}
        title={detail.requestNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {unitLabel} · {detail.propertyName}
            <StatusChip tone={URGENCY_TONE[detail.urgency]}>{URGENCY_LABEL[detail.urgency]}</StatusChip>
          </span>
        }
        footer={
          dirty ? (
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          ) : (
            <Button disabled disabledReason="Nothing has changed yet">
              Save
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-6">
          {saveError ? (
            <p role="alert" className="rounded-sm bg-danger/12 p-3 text-small text-danger">
              {saveError}
            </p>
          ) : null}

          {/* L07-HDR: status dropdown and the urgency dropdown † (D-21). */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Dropdown
              label="Status"
              value={form.statusChoice}
              onChange={(value) => set("statusChoice", value as StatusChoice)}
              options={statusOptions}
            />
            <Dropdown
              label="Urgency"
              value={form.urgency}
              onChange={(value) => set("urgency", value as Urgency)}
              options={urgencyOptions}
              helper={
                detail.suggestedUrgency
                  ? `Tenant said ${URGENCY_LABEL[detail.reportedUrgency]} · suggested ${URGENCY_LABEL[detail.suggestedUrgency]}`
                  : `Tenant said ${URGENCY_LABEL[detail.reportedUrgency]}`
              }
            />
          </div>

          {closedPrompt ? (
            <div className="flex flex-col gap-2 rounded-md border border-line bg-canvas p-3">
              <p className="text-ink">Closed. Add an after photo so the repair is on record.</p>
            </div>
          ) : null}

          {/* L07-SEC-REPORT: what the tenant wrote, verbatim. Never edited. */}
          <section aria-labelledby="l07-report" className="flex flex-col gap-2">
            <h3 id="l07-report" className="text-label uppercase text-muted">
              Report
            </h3>
            <p className="whitespace-pre-wrap text-ink">{detail.description}</p>
            <p className="text-small text-muted">
              {formatDate(detail.createdAt)}
              {reporter ? ` · ${reporter}` : ""} · {REPORTED_VIA_LABEL[detail.reportedVia]}
            </p>
            <p className="text-small text-muted">
              Reported as {reportedCategoryLabel(detail.reportedCategory)} · {URGENCY_LABEL[detail.reportedUrgency]}
              {detail.suggestedCategory ? ` · Suggested ${CATEGORY_LABEL[detail.suggestedCategory]}` : ""}
            </p>
          </section>

          {/* L07-GAL-PHOTOS: before photos from the tenant, after photos added by the landlord. */}
          <section aria-labelledby="l07-photos" className="flex flex-col gap-3">
            <h3 id="l07-photos" className="text-label uppercase text-muted">
              Photos
            </h3>
            <PhotoStrip title="Before" photos={beforePhotos} onEnlarge={setEnlarged} />
            <PhotoStrip title="After" photos={afterPhotos} onEnlarge={setEnlarged} />
            {afterPhotos.length < 10 ? (
              <PhotoUploader
                label="Add after photos"
                photos={after.photos}
                max={10 - afterPhotos.length}
                onAdd={addAfterPhotos}
                onRemove={after.remove}
              />
            ) : null}
            {afterError ? (
              <p role="alert" className="text-small text-danger">
                {afterError}
              </p>
            ) : null}
          </section>

          <Dropdown
            label="Category"
            value={form.category}
            onChange={(value) => set("category", value as Category)}
            options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          />

          <div className="flex flex-col gap-2">
            <VendorField
              vendors={vendors}
              value={form.vendorId}
              onChange={(vendorId) => set("vendorId", vendorId)}
              onVendorAdded={(vendor) => setAddedVendors((current) => [...current, vendor])}
            />
            <div className="flex flex-wrap gap-2">
              {savedVendor && !vendorUnsaved ? (
                <Button icon="share" onClick={dispatch}>
                  Send job to vendor
                </Button>
              ) : (
                <Button
                  icon="share"
                  disabled
                  disabledReason={vendorUnsaved ? "Save the vendor first" : "Choose a vendor first"}
                >
                  Send job to vendor
                </Button>
              )}
              {detail.tenant ? (
                <Button
                  variant="secondary"
                  onClick={() => openComposer(tenantUpdate({ status: detail.status, category: detail.category }))}
                >
                  Update the tenant
                </Button>
              ) : (
                <Button variant="secondary" disabled disabledReason="No tenant lives in this unit">
                  Update the tenant
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {/* L07-FLD-COST "Required to close" · L07-CHK-NOCOST † (D-22). */}
            <MoneyField
              label="What it cost"
              value={form.noCost ? null : form.cost}
              onChange={(value) => {
                setCostError(null);
                set("cost", value);
              }}
              disabled={form.noCost}
              error={costError}
              autoFocus={intent === "close"}
            />
            <Checkbox
              label="No cost"
              checked={form.noCost}
              onChange={(checked) => {
                setCostError(null);
                setForm((current) => ({ ...current, noCost: checked, cost: checked ? null : current.cost }));
              }}
            />
            <Checkbox
              label="Tenant is liable for this cost"
              checked={form.tenantLiable}
              onChange={(checked) => set("tenantLiable", checked)}
              helper="Offers a payment link instead of absorbing the cost."
            />
            {form.tenantLiable ? (
              <div className="flex flex-col gap-1">
                {detail.tenant ? (
                  <Button
                    variant="secondary"
                    icon="rupee"
                    className="self-start"
                    onClick={() =>
                      setSheet({
                        amount: form.noCost ? null : form.cost,
                        note: repairPaymentNote(detail.category, detail.unitNumber),
                        payee: detail.payee,
                      })
                    }
                  >
                    Send payment request
                  </Button>
                ) : (
                  <Button variant="secondary" icon="rupee" disabled disabledReason="No tenant lives in this unit">
                    Send payment request
                  </Button>
                )}
                <p className="text-small text-muted">
                  {detail.paymentRequestedAt
                    ? `Payment requested on ${formatDate(detail.paymentRequestedAt)}`
                    : "Payment not yet requested"}
                  {detail.cost !== null ? ` · recorded cost ${formatRupees(detail.cost)}` : ""}
                </p>
              </div>
            ) : null}
          </div>

          {/* L07-BTN-ADDNOTE † (D-14): internal notes, never shown to the tenant. */}
          <div className="flex flex-col gap-2">
            <TextField
              label="Internal note"
              value={note}
              onChange={setNote}
              helper="Only you see notes."
              error={noteError}
            />
            {note.trim() ? (
              <Button variant="secondary" icon="note" className="self-start" onClick={submitNote} loading={noteSaving}>
                Add note
              </Button>
            ) : (
              <Button variant="secondary" icon="note" className="self-start" disabled disabledReason="Write a note first">
                Add note
              </Button>
            )}
          </div>

          {/* L07-TML-HISTORY. */}
          <section aria-labelledby="l07-history" className="flex flex-col gap-3">
            <h3 id="l07-history" className="text-label uppercase text-muted">
              History
            </h3>
            <Timeline events={history} />
          </section>
        </div>
      </SidePanel>

      {composer ? (
        <ComposerStub target={composer} onClose={closeComposer} />
      ) : null}
      {sheet ? <PaymentSheet sheet={sheet} onClose={() => setSheet(null)} onSendLink={sendPaymentLink} /> : null}
      <Modal open={enlarged !== null} title={enlarged?.alt ?? "Photo"} onClose={() => setEnlarged(null)}>
        {enlarged ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private bucket
          <img src={enlarged.url} alt={enlarged.alt} className="mx-auto max-h-[70dvh] w-auto rounded-sm" />
        ) : null}
      </Modal>
    </>
  );
}

function PhotoStrip({
  title,
  photos,
  onEnlarge,
}: {
  title: string;
  photos: RequestDetail["photos"];
  onEnlarge: (photo: { url: string; alt: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-small text-muted">{title}</span>
      {photos.length === 0 ? (
        <p className="text-small text-muted">None yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onEnlarge(photo)}
              aria-label={`Enlarge: ${photo.alt}`}
              className="h-20 w-20 overflow-hidden rounded-sm border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private bucket */}
              <img src={photo.url} alt={photo.alt} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
