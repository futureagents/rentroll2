import "server-only";

// L-06, L-07 · reads. Every table read goes through the request's Supabase session, so RLS
// limits it to the signed-in landlord's rows (D-04); a request id from another landlord simply
// returns nothing. Photos live in the private `documents` bucket with no storage policies, so
// the server signs short-lived URLs with the service role — only for document rows the RLS
// read above already returned (D-15).
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

import type { AuditRow, MessageRow } from "../_lib/history";
import type {
  BoardCard,
  Category,
  PropertyOption,
  ReportedVia,
  RequestStatus,
  UnitOption,
  Urgency,
  VendorOption,
} from "../_lib/model";

const SIGNED_URL_SECONDS = 10 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

interface DocumentRow {
  id: string;
  request_id: string;
  type: "request_before_photo" | "request_after_photo";
  storage_path: string;
  alt_text: string | null;
  uploaded_at: string;
}

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.storage.from("documents").createSignedUrls(paths, SIGNED_URL_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  return signed;
}

export interface BoardData {
  cards: BoardCard[];
  properties: PropertyOption[];
  units: UnitOption[];
}

/** L-06: every request of the landlord, with unit, property and first before photo. */
export async function loadBoard(): Promise<BoardData> {
  const supabase = await createSupabaseServerClient();
  const [requests, units, properties, photos] = await Promise.all([
    supabase
      .from("request")
      .select("id, request_number, unit_id, tenancy_id, status, category, urgency, description, vendor_id, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("unit").select("id, unit_number, property_id").order("unit_number"),
    supabase.from("property").select("id, name").order("name"),
    supabase
      .from("document")
      .select("id, request_id, storage_path, uploaded_at")
      .eq("type", "request_before_photo")
      .not("request_id", "is", null)
      .order("uploaded_at", { ascending: true }),
  ]);
  for (const result of [requests, units, properties, photos]) {
    if (result.error) throw new Error(result.error.message);
  }

  const propertyRows = (properties.data ?? []) as { id: string; name: string }[];
  const propertyName = new Map(propertyRows.map((p) => [p.id, p.name]));
  const unitRows = (units.data ?? []) as { id: string; unit_number: string; property_id: string }[];
  const unitById = new Map(unitRows.map((u) => [u.id, u]));

  const firstPhoto = new Map<string, string>();
  for (const photo of (photos.data ?? []) as { request_id: string; storage_path: string }[]) {
    if (!firstPhoto.has(photo.request_id)) firstPhoto.set(photo.request_id, photo.storage_path);
  }
  const signed = await signPaths([...firstPhoto.values()]);

  const cards: BoardCard[] = [];
  for (const row of (requests.data ?? []) as {
    id: string;
    request_number: string;
    unit_id: string;
    tenancy_id: string | null;
    status: RequestStatus;
    category: Category;
    urgency: Urgency;
    description: string;
    vendor_id: string | null;
    created_at: string;
  }[]) {
    const unit = unitById.get(row.unit_id);
    if (!unit) continue;
    const path = firstPhoto.get(row.id);
    cards.push({
      id: row.id,
      requestNumber: row.request_number,
      status: row.status,
      category: row.category,
      urgency: row.urgency,
      description: row.description,
      unitNumber: unit.unit_number,
      propertyId: unit.property_id,
      propertyName: propertyName.get(unit.property_id) ?? "",
      vendorId: row.vendor_id,
      hasTenant: row.tenancy_id !== null,
      createdAt: row.created_at,
      thumbnailUrl: path ? (signed.get(path) ?? null) : null,
    });
  }

  return {
    cards,
    properties: propertyRows,
    units: unitRows.map((u) => ({
      id: u.id,
      propertyId: u.property_id,
      label: propertyRows.length > 1 ? `Flat ${u.unit_number} · ${propertyName.get(u.property_id) ?? ""}` : `Flat ${u.unit_number}`,
    })),
  };
}

export interface RequestPhoto {
  id: string;
  kind: "before" | "after";
  url: string;
  alt: string;
}

export interface RequestDetail {
  id: string;
  /** Changes whenever a saved field changes, so the L-07 form can reset to the saved values. */
  version: string;
  requestNumber: string;
  status: RequestStatus;
  reportedVia: ReportedVia;
  reporterName: string | null;
  description: string;
  reportedCategory: Category;
  reportedUrgency: Urgency;
  suggestedCategory: Category | null;
  suggestedUrgency: Urgency | null;
  category: Category;
  urgency: Urgency;
  vendorId: string | null;
  cost: number | null;
  noCost: boolean;
  tenantLiable: boolean;
  paymentRequestedAt: string | null;
  createdAt: string;
  unitNumber: string;
  propertyName: string;
  propertyAddress: string;
  /** Null when the request was logged against a vacant unit (D-29). */
  tenant: { name: string; phone: string } | null;
  photos: RequestPhoto[];
  audits: AuditRow[];
  messages: MessageRow[];
  vendors: VendorOption[];
  /** For S-02 (D-27). Null when no UPI ID is saved yet. */
  payee: { upiId: string; name: string } | null;
}

/** L-07: one request with everything the panel shows. Null when it is not the landlord's. */
export async function loadRequest(requestId: string): Promise<RequestDetail | null> {
  if (!isUuid(requestId)) return null;
  const supabase = await createSupabaseServerClient();

  const { data: row, error } = await supabase
    .from("request")
    .select(
      "id, request_number, unit_id, tenancy_id, status, reported_via, reporter_name, description, " +
        "reported_category, reported_urgency, suggested_category, suggested_urgency, category, urgency, " +
        "vendor_id, cost, no_cost, tenant_liable, payment_requested_at, created_at",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;
  const request = row as unknown as {
    id: string;
    request_number: string;
    unit_id: string;
    tenancy_id: string | null;
    status: RequestStatus;
    reported_via: ReportedVia;
    reporter_name: string | null;
    description: string;
    reported_category: Category;
    reported_urgency: Urgency;
    suggested_category: Category | null;
    suggested_urgency: Urgency | null;
    category: Category;
    urgency: Urgency;
    vendor_id: string | null;
    cost: number | null;
    no_cost: boolean;
    tenant_liable: boolean;
    payment_requested_at: string | null;
    created_at: string;
  };

  const [unit, tenancy, documents, audits, messages, vendors, landlord] = await Promise.all([
    supabase.from("unit").select("unit_number, property_id").eq("id", request.unit_id).single(),
    request.tenancy_id
      ? supabase.from("tenancy").select("name, phone").eq("id", request.tenancy_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("document")
      .select("id, request_id, type, storage_path, alt_text, uploaded_at")
      .eq("request_id", request.id)
      .in("type", ["request_before_photo", "request_after_photo"])
      .order("uploaded_at", { ascending: true }),
    supabase
      .from("audit_event")
      .select("id, kind, old_value, new_value, note, created_at")
      .eq("entity_type", "request")
      .eq("entity_id", request.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("message")
      .select("id, kind, channel, confirmed_at, vendor_id")
      .eq("request_id", request.id)
      .order("confirmed_at", { ascending: true }),
    supabase.from("vendor").select("id, name, phone").order("name"),
    supabase.from("landlord").select("name, upi_id, receipt_name").maybeSingle(),
  ]);
  for (const result of [unit, tenancy, documents, audits, messages, vendors, landlord]) {
    if (result.error) throw new Error(result.error.message);
  }

  const unitRow = unit.data as { unit_number: string; property_id: string };
  const { data: property, error: propertyError } = await supabase
    .from("property")
    .select("name, address")
    .eq("id", unitRow.property_id)
    .single();
  if (propertyError) throw new Error(propertyError.message);

  const vendorRows = (vendors.data ?? []) as VendorOption[];
  const vendorName = new Map(vendorRows.map((v) => [v.id, v.name]));
  const documentRows = (documents.data ?? []) as DocumentRow[];
  const signed = await signPaths(documentRows.map((d) => d.storage_path));
  const landlordRow = landlord.data as { name: string; upi_id: string | null; receipt_name: string | null } | null;
  const tenancyRow = tenancy.data as { name: string; phone: string } | null;
  const propertyRow = property as { name: string; address: string };

  return {
    id: request.id,
    version: [
      request.status,
      request.category,
      request.urgency,
      request.vendor_id,
      request.cost,
      request.no_cost,
      request.tenant_liable,
    ].join("|"),
    requestNumber: request.request_number,
    status: request.status,
    reportedVia: request.reported_via,
    reporterName: request.reporter_name,
    description: request.description,
    reportedCategory: request.reported_category,
    reportedUrgency: request.reported_urgency,
    suggestedCategory: request.suggested_category,
    suggestedUrgency: request.suggested_urgency,
    category: request.category,
    urgency: request.urgency,
    vendorId: request.vendor_id,
    cost: request.cost,
    noCost: request.no_cost,
    tenantLiable: request.tenant_liable,
    paymentRequestedAt: request.payment_requested_at,
    createdAt: request.created_at,
    unitNumber: unitRow.unit_number,
    propertyName: propertyRow.name,
    propertyAddress: propertyRow.address,
    tenant: tenancyRow,
    photos: documentRows.flatMap((d) => {
      const url = signed.get(d.storage_path);
      if (!url) return [];
      const kind = d.type === "request_after_photo" ? "after" : "before";
      return [{ id: d.id, kind, url, alt: d.alt_text ?? (kind === "after" ? "Photo after the repair" : "Photo of the problem") }];
    }),
    audits: (audits.data ?? []) as AuditRow[],
    messages: ((messages.data ?? []) as { id: string; kind: string; channel: string; confirmed_at: string; vendor_id: string | null }[]).map(
      (m) => ({ ...m, vendor_name: m.vendor_id ? (vendorName.get(m.vendor_id) ?? null) : null }),
    ),
    vendors: vendorRows,
    payee:
      landlordRow?.upi_id
        ? { upiId: landlordRow.upi_id, name: landlordRow.receipt_name?.trim() || landlordRow.name }
        : null,
  };
}
