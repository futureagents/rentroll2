import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { unitLabel } from "@/lib/display/unit-label";
import { appBaseUrl } from "@/server/auth/base-url";
import { requireLandlord } from "@/server/auth/session";
import { readUrls } from "@/server/landlord/units/files";
import { getUnitDetail } from "@/server/landlord/units/queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { kolkataDateOf, kolkataToday } from "../_lib/dates";
import { DOCUMENT_TYPE_LABEL } from "../_lib/files";
import { CATEGORY_LABEL, lifetimeFigures, repeatedCategoryNotes } from "../_lib/history";
import { unitOccupancy } from "../_lib/occupancy";
import { agreementInForce, rentChip, rentState } from "../_lib/rent";
import { UnitDetail } from "./unit-detail";
import type { UnitView } from "./view";

// L-09 · Unit detail (spec/screens/L-09.md), a full page. Another landlord's unit id, or any id
// that is not theirs, renders Not found (E4-5).
export const metadata: Metadata = { title: "Unit · RentRoll" };

const REQUEST_STATUS = {
  new: { tone: "primary", label: "New" },
  assigned: { tone: "neutral", label: "Assigned" },
  in_progress: { tone: "warning", label: "In progress" },
  done: { tone: "success", label: "Done" },
} as const;

const PHOTO_TYPES = new Set(["move_in_photo", "request_before_photo", "request_after_photo"]);

export default async function UnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  await requireLandlord(`/units/${unitId}`);
  const db = await createSupabaseServerClient();
  const data = await getUnitDetail(db, unitId);
  if (!data) notFound();

  const today = kolkataToday(new Date());
  const base = await appBaseUrl();
  const admin = createSupabaseAdminClient();
  const photos = data.documents.filter((d) => PHOTO_TYPES.has(d.type));
  const files = data.documents.filter((d) => !PHOTO_TYPES.has(d.type));
  const [photoUrls, fileUrls] = await Promise.all([readUrls(admin, photos), readUrls(admin, files, { download: true })]);

  const label = unitLabel({ unitNumber: data.unit.unit_number, propertyName: data.property.name });
  const tenancyName = new Map(data.tenancies.map((t) => [t.id, t.name]));
  const active = data.tenancies.find((t) => t.status === "active") ?? null;
  const activeTerms = active ? data.terms.filter((t) => t.tenancyId === active.id) : [];
  const termNow = active ? agreementInForce(activeTerms, today) : null;
  const latestTerm = [...activeTerms].sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0] ?? null;

  const paymentsByEntry = new Map<string, typeof data.payments>();
  for (const p of data.payments) paymentsByEntry.set(p.rent_entry_id, [...(paymentsByEntry.get(p.rent_entry_id) ?? []), p]);

  const photoView = (d: (typeof photos)[number], fallbackAlt: string) => ({
    id: d.id,
    src: photoUrls.get(d.id) ?? "",
    alt: d.alt_text || fallbackAlt,
  });

  const view: UnitView = {
    id: data.unit.id,
    unitNumber: data.unit.unit_number,
    label,
    propertyId: data.unit.property_id,
    propertyName: data.property.name,
    propertyAddress: data.property.address,
    type: data.unit.type,
    askingRent: data.unit.rent,
    askingDeposit: data.unit.deposit_amount,
    rent: termNow?.rent ?? data.unit.rent,
    occupancy: unitOccupancy(active ? { status: active.status, noticeVacateOn: active.notice_vacate_on } : null),
    current: active
      ? {
          tenancyId: active.id,
          name: active.name,
          phone: active.phone,
          movedInOn: active.moved_in_on,
          agreementEndsOn: latestTerm?.endsOn ?? null,
          depositPaid: active.deposit_paid,
          noticeVacateOn: active.notice_vacate_on,
          tenantLink: `${base}/u/${active.tenant_token}`,
          moveInPhotoCount: data.documents.filter((d) => d.type === "move_in_photo" && d.tenancy_id === active.id).length,
        }
      : null,
    doorLink: `${base}/u/${data.unit.door_token}`,
    figures: lifetimeFigures(
      data.payments.map((p) => ({ amount: p.amount, status: p.status, receivedOn: p.received_on })),
      data.requests.map((r) => ({ status: r.status, cost: r.cost, doneAt: r.done_at })),
      today,
    ),
    historySince: data.tenancies.length ? data.tenancies[data.tenancies.length - 1].moved_in_on : null,
    rentRows: data.rentEntries.map((e) => {
      const payments = (paymentsByEntry.get(e.id) ?? []).map((p) => ({ amount: p.amount, status: p.status, receivedOn: p.received_on }));
      const state = rentState({ amountDue: e.amount_due, dueOn: e.due_on, payments }, today);
      return {
        id: e.id,
        month: e.month,
        tenantName: tenancyName.get(e.tenancy_id) ?? "",
        amountDue: e.amount_due,
        paid: state.paid,
        isProRata: e.is_pro_rata,
        chip: rentChip(state),
      };
    }),
    requests: data.requests.map((r) => ({
      id: r.id,
      number: r.request_number,
      reportedOn: kolkataDateOf(r.created_at),
      category: CATEGORY_LABEL[r.category] ?? r.category,
      status: REQUEST_STATUS[r.status],
      cost: r.cost,
      noCost: r.no_cost,
      done: r.status === "done",
      description: r.description,
    })),
    repeatNotes: repeatedCategoryNotes(
      data.requests.map((r) => ({ category: r.category, createdAt: r.created_at })),
      today,
    ),
    moveIn: data.tenancies.map((t) => ({
      tenancyId: t.id,
      tenantName: t.name,
      movedInOn: t.moved_in_on,
      endedOn: t.ended_on,
      active: t.status === "active",
      photos: photos
        .filter((d) => d.type === "move_in_photo" && d.tenancy_id === t.id)
        .map((d, i) => photoView(d, `Move-in condition photo ${i + 1}, ${label}, ${t.name}'s tenancy`)),
    })),
    repairs: data.requests
      .map((r) => ({
        requestId: r.id,
        number: r.request_number,
        photos: photos
          .filter((d) => d.request_id === r.id)
          .map((d, i) => ({
            ...photoView(d, `${d.type === "request_after_photo" ? "After repair" : "Reported problem"} photo ${i + 1}, ${r.request_number}`),
            after: d.type === "request_after_photo",
          })),
      }))
      .filter((r) => r.photos.length > 0),
    documents: files.map((d) => ({
      id: d.id,
      typeLabel: DOCUMENT_TYPE_LABEL[d.type] ?? d.type,
      fileName: d.file_name,
      tenantName: d.tenancy_id ? (tenancyName.get(d.tenancy_id) ?? null) : null,
      uploadedOn: kolkataDateOf(d.uploaded_at),
      url: fileUrls.get(d.id) ?? null,
    })),
    canDelete: data.tenancies.length === 0 && data.requests.length === 0,
    siblings: data.siblings.map((s) => ({ id: s.id, propertyId: data.unit.property_id, unitNumber: s.unit_number })),
    today,
  };

  return <UnitDetail view={view} />;
}
