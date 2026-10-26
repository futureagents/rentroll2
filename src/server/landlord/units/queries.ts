import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid } from "@/app/(landlord)/units/_lib/files";
import { agreementInForce, type AgreementTerm } from "@/app/(landlord)/units/_lib/rent";
import type { IsoDate } from "@/app/(landlord)/units/_lib/dates";
import type { RequestCategory } from "@/app/(landlord)/units/_lib/history";
import type { TenancyStatus } from "@/app/(landlord)/units/_lib/occupancy";

// Reads for L-08, L-09, L-10, L-11 and P-03. Every function takes the landlord's own RLS-scoped
// client, so another landlord's rows are simply absent and the page renders Not found (D-04,
// E4-5). Ids that are not UUIDs never reach the database. Tokens are read here only to build the
// links L-09 copies and P-03 prints (D-01); no landlord URL ever carries one.

type Db = SupabaseClient;

export interface PropertyRow {
  id: string;
  name: string;
  address: string;
}

interface UnitRecord {
  id: string;
  property_id: string;
  unit_number: string;
  type: string | null;
  rent: number;
  deposit_amount: number;
  door_token: string;
}

interface TenancyRecord {
  id: string;
  unit_id: string;
  name: string;
  phone: string;
  email: string | null;
  moved_in_on: IsoDate;
  ended_on: IsoDate | null;
  status: TenancyStatus;
  deposit_paid: number;
  deposit_received_on: IsoDate | null;
  notice_given_on: IsoDate | null;
  notice_vacate_on: IsoDate | null;
  tenant_token: string;
}

interface AgreementRecord {
  id: string;
  tenancy_id: string;
  starts_on: IsoDate;
  ends_on: IsoDate;
  rent: number;
  rent_due_day: number;
}

export interface Term extends AgreementTerm {
  tenancyId: string;
}

function toTerm(a: AgreementRecord): Term {
  return { id: a.id, tenancyId: a.tenancy_id, startsOn: a.starts_on, endsOn: a.ends_on, rent: a.rent, rentDueDay: a.rent_due_day };
}

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

const TENANCY_COLUMNS =
  "id, unit_id, name, phone, email, moved_in_on, ended_on, status, deposit_paid, deposit_received_on, notice_given_on, notice_vacate_on, tenant_token";

// ---------------------------------------------------------------------------------------------
// L-08 · Unit register
// ---------------------------------------------------------------------------------------------

export interface UnitListRow {
  id: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  type: string | null;
  /** D-23: the current agreement's rent when occupied, otherwise `unit.rent`. */
  rent: number;
  deposit: number;
  tenantName: string | null;
  activeTenancy: { status: TenancyStatus; noticeVacateOn: IsoDate | null } | null;
}

export async function listUnits(db: Db, today: IsoDate): Promise<{ properties: PropertyRow[]; units: UnitListRow[] }> {
  const [properties, units, tenancies] = await Promise.all([
    db.from("property").select("id, name, address").order("name").then(must<PropertyRow[]>),
    db.from("unit").select("id, property_id, unit_number, type, rent, deposit_amount").then(must<Omit<UnitRecord, "door_token">[]>),
    db.from("tenancy").select("id, unit_id, name, status, notice_vacate_on").eq("status", "active").then(
      must<Pick<TenancyRecord, "id" | "unit_id" | "name" | "status" | "notice_vacate_on">[]>,
    ),
  ]);
  const agreements =
    tenancies.length === 0
      ? []
      : await db
          .from("agreement")
          .select("id, tenancy_id, starts_on, ends_on, rent, rent_due_day")
          .in("tenancy_id", tenancies.map((t) => t.id))
          .then(must<AgreementRecord[]>);

  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const activeByUnit = new Map(tenancies.map((t) => [t.unit_id, t]));
  return {
    properties,
    units: units.map((u) => {
      const active = activeByUnit.get(u.id) ?? null;
      const term = active ? agreementInForce(agreements.filter((a) => a.tenancy_id === active.id).map(toTerm), today) : null;
      return {
        id: u.id,
        propertyId: u.property_id,
        propertyName: propertyName.get(u.property_id) ?? "",
        unitNumber: u.unit_number,
        type: u.type,
        rent: term?.rent ?? u.rent,
        deposit: u.deposit_amount,
        tenantName: active?.name ?? null,
        activeTenancy: active ? { status: active.status, noticeVacateOn: active.notice_vacate_on } : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// L-09 · Unit detail
// ---------------------------------------------------------------------------------------------

export interface DocumentRecord {
  id: string;
  type: string;
  tenancy_id: string | null;
  request_id: string | null;
  file_name: string;
  mime: string;
  alt_text: string | null;
  uploaded_at: string;
  storage_path: string;
}

export interface UnitDetailData {
  unit: UnitRecord;
  property: PropertyRow;
  /** Every tenancy the unit has had, newest first. */
  tenancies: TenancyRecord[];
  terms: Term[];
  rentEntries: { id: string; tenancy_id: string; month: IsoDate; amount_due: number; due_on: IsoDate; is_pro_rata: boolean }[];
  payments: { rent_entry_id: string; amount: number; status: "recorded" | "voided"; received_on: IsoDate }[];
  requests: {
    id: string;
    request_number: string;
    category: RequestCategory;
    status: "new" | "assigned" | "in_progress" | "done";
    cost: number | null;
    no_cost: boolean;
    done_at: string | null;
    created_at: string;
    description: string;
  }[];
  documents: DocumentRecord[];
  /** Units in the same property, for the per-property uniqueness rule on L09-BTN-EDITUNIT. */
  siblings: { id: string; unit_number: string }[];
}

export async function getUnitDetail(db: Db, unitId: string): Promise<UnitDetailData | null> {
  if (!isUuid(unitId)) return null;
  const unit = await db
    .from("unit")
    .select("id, property_id, unit_number, type, rent, deposit_amount, door_token")
    .eq("id", unitId)
    .maybeSingle()
    .then((r) => {
      if (r.error) throw new Error(r.error.message);
      return r.data as UnitRecord | null;
    });
  if (!unit) return null;

  const [property, tenancies, rentEntries, requests, documents, siblings] = await Promise.all([
    db.from("property").select("id, name, address").eq("id", unit.property_id).single().then(must<PropertyRow>),
    db.from("tenancy").select(TENANCY_COLUMNS).eq("unit_id", unitId).order("moved_in_on", { ascending: false }).then(must<TenancyRecord[]>),
    db
      .from("rent_entry")
      .select("id, tenancy_id, month, amount_due, due_on, is_pro_rata")
      .eq("unit_id", unitId)
      .order("month", { ascending: false })
      .then(must<UnitDetailData["rentEntries"]>),
    db
      .from("request")
      .select("id, request_number, category, status, cost, no_cost, done_at, created_at, description")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false })
      .then(must<UnitDetailData["requests"]>),
    db
      .from("document")
      .select("id, type, tenancy_id, request_id, file_name, mime, alt_text, uploaded_at, storage_path")
      .eq("unit_id", unitId)
      .order("uploaded_at", { ascending: true })
      .then(must<DocumentRecord[]>),
    db.from("unit").select("id, unit_number").eq("property_id", unit.property_id).then(must<UnitDetailData["siblings"]>),
  ]);

  const tenancyIds = tenancies.map((t) => t.id);
  const [agreements, payments] =
    tenancyIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .from("agreement")
            .select("id, tenancy_id, starts_on, ends_on, rent, rent_due_day")
            .in("tenancy_id", tenancyIds)
            .then(must<AgreementRecord[]>),
          // payment carries tenancy_id (copied by trigger), so one filter covers every month.
          db
            .from("payment")
            .select("rent_entry_id, amount, status, received_on")
            .in("tenancy_id", tenancyIds)
            .then(must<UnitDetailData["payments"]>),
        ]);

  return { unit, property, tenancies, terms: agreements.map(toTerm), rentEntries, payments, requests, documents, siblings };
}

// ---------------------------------------------------------------------------------------------
// L-10 · Tenant list
// ---------------------------------------------------------------------------------------------

export interface TenancyListRow {
  id: string;
  name: string;
  phone: string;
  unitNumber: string;
  propertyName: string;
  status: TenancyStatus;
  noticeVacateOn: IsoDate | null;
  /** The latest agreement's end (D-08, as L-12 reads it). */
  agreementEndsOn: IsoDate | null;
  movedInOn: IsoDate;
  endedOn: IsoDate | null;
}

export async function listTenancies(db: Db): Promise<TenancyListRow[]> {
  const [tenancies, units, properties, agreements] = await Promise.all([
    db
      .from("tenancy")
      .select("id, unit_id, name, phone, status, notice_vacate_on, moved_in_on, ended_on")
      .order("name")
      .then(must<Pick<TenancyRecord, "id" | "unit_id" | "name" | "phone" | "status" | "notice_vacate_on" | "moved_in_on" | "ended_on">[]>),
    db.from("unit").select("id, property_id, unit_number").then(must<Pick<UnitRecord, "id" | "property_id" | "unit_number">[]>),
    db.from("property").select("id, name").then(must<Pick<PropertyRow, "id" | "name">[]>),
    db.from("agreement").select("tenancy_id, ends_on, starts_on").then(must<Pick<AgreementRecord, "tenancy_id" | "ends_on" | "starts_on">[]>),
  ]);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const latestEnd = new Map<string, { startsOn: IsoDate; endsOn: IsoDate }>();
  for (const a of agreements) {
    const seen = latestEnd.get(a.tenancy_id);
    if (!seen || a.starts_on > seen.startsOn) latestEnd.set(a.tenancy_id, { startsOn: a.starts_on, endsOn: a.ends_on });
  }
  return tenancies.map((t) => {
    const unit = unitById.get(t.unit_id);
    return {
      id: t.id,
      name: t.name,
      phone: t.phone,
      unitNumber: unit?.unit_number ?? "",
      propertyName: unit ? (propertyName.get(unit.property_id) ?? "") : "",
      status: t.status,
      noticeVacateOn: t.notice_vacate_on,
      agreementEndsOn: latestEnd.get(t.id)?.endsOn ?? null,
      movedInOn: t.moved_in_on,
      endedOn: t.ended_on,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// L-11 · Tenant detail
// ---------------------------------------------------------------------------------------------

export interface TenancyDetailData {
  tenancy: TenancyRecord;
  unit: Pick<UnitRecord, "id" | "unit_number">;
  property: PropertyRow;
  terms: Term[];
  rentEntries: UnitDetailData["rentEntries"];
  payments: (UnitDetailData["payments"][number] & { receipt_number: string })[];
  documents: DocumentRecord[];
}

export async function getTenancyDetail(db: Db, tenancyId: string): Promise<TenancyDetailData | null> {
  if (!isUuid(tenancyId)) return null;
  const tenancy = await db
    .from("tenancy")
    .select(TENANCY_COLUMNS)
    .eq("id", tenancyId)
    .maybeSingle()
    .then((r) => {
      if (r.error) throw new Error(r.error.message);
      return r.data as TenancyRecord | null;
    });
  if (!tenancy) return null;

  const [unit, agreements, rentEntries, payments, documents] = await Promise.all([
    db.from("unit").select("id, unit_number, property_id").eq("id", tenancy.unit_id).single().then(must<Pick<UnitRecord, "id" | "unit_number" | "property_id">>),
    db
      .from("agreement")
      .select("id, tenancy_id, starts_on, ends_on, rent, rent_due_day")
      .eq("tenancy_id", tenancyId)
      .then(must<AgreementRecord[]>),
    db
      .from("rent_entry")
      .select("id, tenancy_id, month, amount_due, due_on, is_pro_rata")
      .eq("tenancy_id", tenancyId)
      .order("month", { ascending: false })
      .then(must<UnitDetailData["rentEntries"]>),
    db
      .from("payment")
      .select("rent_entry_id, amount, status, received_on, receipt_number")
      .eq("tenancy_id", tenancyId)
      .order("received_on")
      .then(must<TenancyDetailData["payments"]>),
    db
      .from("document")
      .select("id, type, tenancy_id, request_id, file_name, mime, alt_text, uploaded_at, storage_path")
      .eq("tenancy_id", tenancyId)
      .order("uploaded_at", { ascending: true })
      .then(must<DocumentRecord[]>),
  ]);
  const property = await db.from("property").select("id, name, address").eq("id", unit.property_id).single().then(must<PropertyRow>);

  return { tenancy, unit: { id: unit.id, unit_number: unit.unit_number }, property, terms: agreements.map(toTerm), rentEntries, payments, documents };
}

// ---------------------------------------------------------------------------------------------
// P-03 · Door QR cards
// ---------------------------------------------------------------------------------------------

export interface DoorCardRow {
  id: string;
  unitNumber: string;
  propertyName: string;
  doorToken: string;
}

/** The units to print, in the order asked; `ids === null` prints every unit. Unknown ids drop out. */
export async function doorCardUnits(db: Db, ids: string[] | null): Promise<{ units: DoorCardRow[]; landlordPhone: string | null }> {
  const wanted = ids?.filter(isUuid) ?? null;
  if (wanted && wanted.length === 0) return { units: [], landlordPhone: null };
  let query = db.from("unit").select("id, property_id, unit_number, door_token");
  if (wanted) query = query.in("id", wanted);
  const [units, properties, landlord] = await Promise.all([
    query.then(must<Pick<UnitRecord, "id" | "property_id" | "unit_number" | "door_token">[]>),
    db.from("property").select("id, name").then(must<Pick<PropertyRow, "id" | "name">[]>),
    db.from("landlord").select("phone").maybeSingle().then((r) => (r.data as { phone: string | null } | null)?.phone ?? null),
  ]);
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const rows = units.map((u) => ({ id: u.id, unitNumber: u.unit_number, propertyName: propertyName.get(u.property_id) ?? "", doorToken: u.door_token }));
  return { units: rows, landlordPhone: landlord };
}
