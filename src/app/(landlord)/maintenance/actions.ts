"use server";

// L-06, L-07 · writes. Every action re-checks the session (requireLandlord) and writes through
// the request's Supabase session, so RLS keeps it to the landlord's own rows (D-04). Each change
// to a request writes its audit_event (D-14; shapes in _lib/history.ts). Nothing here sends a
// message: a `message` row is written only after the landlord answers "Yes" to "Did you send
// it?" in S-01 (G-1, D-17, D-28).
import { refresh } from "next/cache";

import { requireLandlord } from "@/server/auth/session";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { URGENCY_RANK } from "./_lib/board";
import { DESCRIPTION_SHORT, closeError, planMove, statusAfterDispatch } from "./_lib/lifecycle";
import {
  LANDLORD_REPORTED_VIA,
  isCategory,
  isStatus,
  isUrgency,
  type Category,
  type LandlordReportedVia,
  type RequestStatus,
  type Urgency,
} from "./_lib/model";
import { isUuid } from "./_server/queries";

/** E1-07. */
const SAVE_FAILED = "Could not save. Your changes are still here — try again.";
const NOT_FOUND = "Not found.";
const PHONE = /^\+91[0-9]{10}$/;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // the bucket limit (decisions §9)
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/webp"]);

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

interface CurrentRow {
  id: string;
  status: RequestStatus;
  category: Category;
  urgency: Urgency;
  reported_urgency: Urgency;
  vendor_id: string | null;
  cost: number | null;
  no_cost: boolean;
  tenant_liable: boolean;
  tenancy_id: string | null;
}

async function session(requestId: string) {
  const landlord = await requireLandlord(`/maintenance/${requestId}`);
  const supabase = await createSupabaseServerClient();
  return { landlord, supabase };
}

async function currentRow(supabase: Supabase, requestId: string): Promise<CurrentRow | null> {
  if (!isUuid(requestId)) return null;
  const { data } = await supabase
    .from("request")
    .select("id, status, category, urgency, reported_urgency, vendor_id, cost, no_cost, tenant_liable, tenancy_id")
    .eq("id", requestId)
    .maybeSingle();
  return (data as CurrentRow | null) ?? null;
}

interface AuditInsert {
  kind: string;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  note?: string | null;
}

async function writeAudits(supabase: Supabase, landlordId: string, requestId: string, audits: AuditInsert[]) {
  if (audits.length === 0) return null;
  const { error } = await supabase.from("audit_event").insert(
    audits.map((audit) => ({
      landlord_id: landlordId,
      actor: "landlord",
      entity_type: "request",
      entity_id: requestId,
      kind: audit.kind,
      old_value: audit.old_value ?? null,
      new_value: audit.new_value ?? null,
      note: audit.note ?? null,
    })),
  );
  return error;
}

/**
 * L-06 drag between columns other than Done (D-32). A drag to Done is not a move: the board
 * opens L-07 with Done chosen and the move commits when L-07 saves (D-22). A drag out of Done
 * reopens to `assigned` or `new` (D-32) and writes the timeline entry, never a new request.
 */
export async function moveRequest(
  requestId: string,
  to: RequestStatus,
): Promise<ActionResult<{ status: RequestStatus; reopened: boolean }>> {
  const { landlord, supabase } = await session(requestId);
  if (!isStatus(to)) return { ok: false, error: SAVE_FAILED };
  const row = await currentRow(supabase, requestId);
  if (!row) return { ok: false, error: NOT_FOUND };

  const plan = planMove(row.status, to, row.vendor_id);
  if (plan.kind === "none") return { ok: true, status: row.status, reopened: false };
  if (plan.kind === "close") return { ok: false, error: "Open the request to record what it cost." };

  const { error } = await supabase
    .from("request")
    .update({ status: plan.status, done_at: null })
    .eq("id", row.id)
    .eq("status", row.status); // a concurrent change wins; this one then fails visibly
  if (error) return { ok: false, error: SAVE_FAILED };
  const reopened = plan.kind === "reopen";
  const auditError = await writeAudits(supabase, landlord.landlordId, row.id, [
    {
      kind: "status_change",
      old_value: { status: row.status },
      new_value: reopened ? { status: plan.status, reopened: true } : { status: plan.status },
    },
  ]);
  if (auditError) return { ok: false, error: SAVE_FAILED };
  refresh();
  return { ok: true, status: plan.status, reopened };
}

export interface SaveRequestInput {
  requestId: string;
  status: RequestStatus;
  category: Category;
  urgency: Urgency;
  vendorId: string | null;
  cost: number | null;
  noCost: boolean;
  tenantLiable: boolean;
}

/** L-07 save: status (L07-HDR), category (L07-SEL-CATEGORY), urgency (D-21), vendor, cost, no cost, tenant liable. */
export async function saveRequest(
  input: SaveRequestInput,
): Promise<ActionResult<{ status: RequestStatus; closed: boolean; reopened: boolean }>> {
  const { landlord, supabase } = await session(input.requestId);
  if (!isStatus(input.status) || !isCategory(input.category) || !isUrgency(input.urgency)) {
    return { ok: false, error: SAVE_FAILED };
  }
  if (input.vendorId !== null && !isUuid(input.vendorId)) return { ok: false, error: SAVE_FAILED };
  const cost = input.noCost ? null : input.cost;
  if (cost !== null && (!Number.isInteger(cost) || cost < 0)) return { ok: false, error: "Enter the cost in whole rupees." };

  const row = await currentRow(supabase, input.requestId);
  if (!row) return { ok: false, error: NOT_FOUND };

  // D-21: the effective urgency may be raised but never set below what the tenant reported.
  if (URGENCY_RANK[input.urgency] > URGENCY_RANK[row.reported_urgency]) {
    return { ok: false, error: "Urgency cannot be lower than the tenant reported." };
  }

  const plan = planMove(row.status, input.status, input.vendorId);
  if (plan.kind === "close") {
    const problem = closeError(cost, input.noCost);
    if (problem) return { ok: false, error: problem };
  }
  const nextStatus: RequestStatus =
    plan.kind === "close" ? "done" : plan.kind === "none" ? row.status : plan.status;

  let vendorName: string | null = null;
  if (input.vendorId && input.vendorId !== row.vendor_id) {
    const { data } = await supabase.from("vendor").select("name").eq("id", input.vendorId).maybeSingle();
    if (!data) return { ok: false, error: SAVE_FAILED };
    vendorName = (data as { name: string }).name;
  }

  const update: Record<string, unknown> = {
    category: input.category,
    urgency: input.urgency,
    vendor_id: input.vendorId,
    cost,
    no_cost: input.noCost,
    tenant_liable: input.tenantLiable,
    status: nextStatus,
  };
  if (plan.kind === "close") update.done_at = new Date().toISOString();
  if (plan.kind === "reopen" || plan.kind === "move") update.done_at = null;

  const { error } = await supabase.from("request").update(update).eq("id", row.id).eq("status", row.status);
  if (error) return { ok: false, error: SAVE_FAILED };

  const audits: AuditInsert[] = [];
  if (input.category !== row.category) {
    audits.push({ kind: "category_change", old_value: { category: row.category }, new_value: { category: input.category } });
  }
  if (input.urgency !== row.urgency) {
    audits.push({ kind: "urgency_change", old_value: { urgency: row.urgency }, new_value: { urgency: input.urgency } });
  }
  if (input.vendorId !== row.vendor_id) {
    audits.push({
      kind: "vendor_set",
      old_value: { vendor_id: row.vendor_id },
      new_value: { vendor_id: input.vendorId, name: vendorName },
    });
  }
  if (cost !== row.cost || input.noCost !== row.no_cost) {
    audits.push({
      kind: "cost_recorded",
      old_value: { cost: row.cost, no_cost: row.no_cost },
      new_value: { cost, no_cost: input.noCost },
    });
  }
  if (input.tenantLiable !== row.tenant_liable) {
    audits.push({ kind: "tenant_liable", old_value: { tenant_liable: row.tenant_liable }, new_value: { tenant_liable: input.tenantLiable } });
  }
  if (nextStatus !== row.status) {
    audits.push({
      kind: "status_change",
      old_value: { status: row.status },
      new_value: plan.kind === "reopen" ? { status: nextStatus, reopened: true } : { status: nextStatus },
    });
  }
  const auditError = await writeAudits(supabase, landlord.landlordId, row.id, audits);
  if (auditError) return { ok: false, error: SAVE_FAILED };

  refresh();
  return { ok: true, status: nextStatus, closed: plan.kind === "close", reopened: plan.kind === "reopen" };
}

/** L07-FLD-VENDOR "Add <name>" (D-16): creates a vendor and asks for the phone. */
export async function addVendor(name: string, phoneDigits: string): Promise<ActionResult<{ vendor: { id: string; name: string; phone: string } }>> {
  const landlord = await requireLandlord("/maintenance");
  const supabase = await createSupabaseServerClient();
  const trimmed = name.trim();
  const phone = `+91${phoneDigits.replace(/\D/g, "")}`;
  if (!trimmed) return { ok: false, error: "This is needed to continue." };
  if (!PHONE.test(phone)) return { ok: false, error: "Enter the 10-digit mobile number." };
  const { data, error } = await supabase
    .from("vendor")
    .insert({ landlord_id: landlord.landlordId, name: trimmed, phone })
    .select("id, name, phone")
    .single();
  if (error || !data) return { ok: false, error: SAVE_FAILED };
  return { ok: true, vendor: data as { id: string; name: string; phone: string } };
}

/** L07-BTN-ADDNOTE † (D-14): an internal note, landlord-only, never readable by the tenant (D-30). */
export async function addNote(requestId: string, text: string): Promise<ActionResult> {
  const { landlord, supabase } = await session(requestId);
  const note = text.trim();
  if (!note) return { ok: false, error: "This is needed to continue." };
  const row = await currentRow(supabase, requestId);
  if (!row) return { ok: false, error: NOT_FOUND };
  const error = await writeAudits(supabase, landlord.landlordId, row.id, [{ kind: "note", note }]);
  if (error) return { ok: false, error: SAVE_FAILED };
  refresh();
  return { ok: true };
}

export type SentKind = "vendor_dispatch" | "tenant_update" | "payment_link";

export interface ConfirmSentInput {
  requestId: string;
  kind: SentKind;
  channel: "whatsapp" | "copy";
  /** The composer text at the moment of "Yes" (D-17). */
  body: string;
  vendorId: string | null;
}

/**
 * S01-STATE-CONFIRMSEND → "Yes" (D-17). The landlord already pressed send outside the app;
 * this only records it. Confirming a vendor dispatch moves New to Assigned (D-32); confirming a
 * payment request sets `payment_requested_at` (D-35).
 */
export async function confirmSent(input: ConfirmSentInput): Promise<ActionResult> {
  const { landlord, supabase } = await session(input.requestId);
  if (!["vendor_dispatch", "tenant_update", "payment_link"].includes(input.kind)) return { ok: false, error: SAVE_FAILED };
  if (input.channel !== "whatsapp" && input.channel !== "copy") return { ok: false, error: SAVE_FAILED };
  const body = input.body.trim();
  if (!body) return { ok: false, error: SAVE_FAILED };
  const row = await currentRow(supabase, input.requestId);
  if (!row) return { ok: false, error: NOT_FOUND };
  if (input.kind === "vendor_dispatch" && (!input.vendorId || input.vendorId !== row.vendor_id)) {
    return { ok: false, error: "Save the vendor on this request first." };
  }
  if (input.kind !== "vendor_dispatch" && !row.tenancy_id) return { ok: false, error: SAVE_FAILED };

  const { error } = await supabase.from("message").insert({
    landlord_id: landlord.landlordId,
    kind: input.kind,
    channel: input.channel,
    request_id: row.id,
    tenancy_id: row.tenancy_id,
    vendor_id: input.kind === "vendor_dispatch" ? input.vendorId : null,
    body,
  });
  if (error) return { ok: false, error: SAVE_FAILED };

  if (input.kind === "vendor_dispatch") {
    const next = statusAfterDispatch(row.status);
    if (next !== row.status) {
      const { error: moveError } = await supabase.from("request").update({ status: next }).eq("id", row.id).eq("status", row.status);
      if (moveError) return { ok: false, error: SAVE_FAILED };
      const auditError = await writeAudits(supabase, landlord.landlordId, row.id, [
        { kind: "status_change", old_value: { status: row.status }, new_value: { status: next } },
      ]);
      if (auditError) return { ok: false, error: SAVE_FAILED };
    }
  }
  if (input.kind === "payment_link") {
    const { error: stampError } = await supabase
      .from("request")
      .update({ payment_requested_at: new Date().toISOString() })
      .eq("id", row.id);
    if (stampError) return { ok: false, error: SAVE_FAILED };
  }
  refresh();
  return { ok: true };
}

export interface NewRequestInput {
  unitId: string;
  reportedVia: LandlordReportedVia;
  reporterName: string;
  /** Ten digits or empty (A2 Phone field). */
  reporterPhone: string;
  category: Category;
  urgency: Urgency;
  description: string;
}

/**
 * L06-BTN-NEW: "the same form as T-01, with an added unit selector and a 'reported by' field
 * defaulting to 'phone call'". D-29: the request belongs to the unit's active tenancy (or none
 * when vacant), so it appears on that tenant's T-03 with the tenant-safe fields only.
 */
export async function logRequest(input: NewRequestInput): Promise<ActionResult<{ requestId: string; requestNumber: string }>> {
  const landlord = await requireLandlord("/maintenance");
  const supabase = await createSupabaseServerClient();
  const description = input.description.trim();
  if (!isUuid(input.unitId) || !description) return { ok: false, error: "This is needed to continue." };
  if (description.length < 10) return { ok: false, error: DESCRIPTION_SHORT };
  const phoneDigits = input.reporterPhone.replace(/\D/g, "");
  if (phoneDigits && phoneDigits.length !== 10) return { ok: false, error: "Enter the 10-digit mobile number." };
  if (!(LANDLORD_REPORTED_VIA as readonly string[]).includes(input.reportedVia)) return { ok: false, error: SAVE_FAILED };
  if (!isCategory(input.category) || !isUrgency(input.urgency)) return { ok: false, error: SAVE_FAILED };

  const { data: unit } = await supabase.from("unit").select("id").eq("id", input.unitId).maybeSingle();
  if (!unit) return { ok: false, error: NOT_FOUND };
  const { data: tenancy } = await supabase
    .from("tenancy")
    .select("id")
    .eq("unit_id", input.unitId)
    .eq("status", "active")
    .maybeSingle();

  const { data, error } = await supabase
    .from("request")
    .insert({
      unit_id: input.unitId,
      tenancy_id: (tenancy as { id: string } | null)?.id ?? null,
      reported_via: input.reportedVia,
      reporter_name: input.reporterName.trim() || null,
      reporter_phone: phoneDigits ? `+91${phoneDigits}` : null,
      description,
      reported_category: input.category,
      reported_urgency: input.urgency,
    })
    .select("id, request_number")
    .single();
  if (error || !data) return { ok: false, error: SAVE_FAILED };
  const created = data as { id: string; request_number: string };
  await writeAudits(supabase, landlord.landlordId, created.id, [
    { kind: "created", new_value: { reported_via: input.reportedVia } },
  ]);
  refresh();
  return { ok: true, requestId: created.id, requestNumber: created.request_number };
}

export interface PhotoUpload {
  documentId: string;
  path: string;
  token: string;
}

/**
 * Photos for a request: before photos from L06-BTN-NEW, after photos on L-07 (L07-UPL-AFTER †,
 * D-22). The server picks the storage path (`<landlord_id>/<document_id>`, D-15) and hands out
 * one-time signed upload URLs; the browser uploads straight to the private bucket.
 * Compression is S-04's job and not done here.
 */
export async function createPhotoUploads(
  requestId: string,
  files: { type: string; size: number }[],
): Promise<ActionResult<{ uploads: PhotoUpload[] }>> {
  const { landlord, supabase } = await session(requestId);
  const row = await currentRow(supabase, requestId);
  if (!row) return { ok: false, error: NOT_FOUND };
  if (files.length === 0 || files.length > 10) return { ok: false, error: "Up to 10 photos." };
  for (const file of files) {
    if (!PHOTO_TYPES.has(file.type)) return { ok: false, error: "That file type is not supported" };
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "That file is too large" };
  }
  const admin = createSupabaseAdminClient();
  const uploads: PhotoUpload[] = [];
  for (let i = 0; i < files.length; i++) {
    const documentId = crypto.randomUUID();
    const path = `${landlord.landlordId}/${documentId}`;
    const { data, error } = await admin.storage.from("documents").createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: SAVE_FAILED };
    uploads.push({ documentId, path, token: data.token });
  }
  return { ok: true, uploads };
}

/** Records uploaded photos as `document` rows once the files are in the bucket. */
export async function recordPhotos(
  requestId: string,
  kind: "before" | "after",
  photos: { documentId: string; fileName: string }[],
): Promise<ActionResult> {
  const { landlord, supabase } = await session(requestId);
  const row = await currentRow(supabase, requestId);
  if (!row) return { ok: false, error: NOT_FOUND };
  const admin = createSupabaseAdminClient();
  const unit = await supabase.from("request").select("unit_id").eq("id", row.id).single();
  if (unit.error) return { ok: false, error: SAVE_FAILED };
  const unitId = (unit.data as { unit_id: string }).unit_id;

  const rows = [];
  for (const photo of photos) {
    if (!isUuid(photo.documentId)) return { ok: false, error: SAVE_FAILED };
    const path = `${landlord.landlordId}/${photo.documentId}`;
    const { data: info, error } = await admin.storage.from("documents").info(path);
    if (error || !info) return { ok: false, error: SAVE_FAILED };
    const mime = info.contentType ?? "image/jpeg";
    if (!PHOTO_TYPES.has(mime)) return { ok: false, error: "That file type is not supported" };
    rows.push({
      id: photo.documentId,
      landlord_id: landlord.landlordId,
      unit_id: unitId,
      tenancy_id: row.tenancy_id,
      request_id: row.id,
      type: kind === "after" ? "request_after_photo" : "request_before_photo",
      storage_path: path,
      file_name: photo.fileName.slice(0, 200) || "photo",
      mime,
      size_bytes: info.size ?? 0,
      alt_text: kind === "after" ? "Photo after the repair" : "Photo of the problem",
      uploaded_by: "landlord",
    });
  }
  const { error } = await supabase.from("document").insert(rows);
  if (error) return { ok: false, error: SAVE_FAILED };
  if (kind === "after") {
    const auditError = await writeAudits(
      supabase,
      landlord.landlordId,
      row.id,
      rows.map((r) => ({ kind: "after_photo_added", new_value: { document_id: r.id } })),
    );
    if (auditError) return { ok: false, error: SAVE_FAILED };
  }
  refresh();
  return { ok: true };
}
