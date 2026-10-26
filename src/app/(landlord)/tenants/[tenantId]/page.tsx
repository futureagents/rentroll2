import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { unitLabel } from "@/lib/display/unit-label";
import { requireLandlord } from "@/server/auth/session";
import { readUrls } from "@/server/landlord/units/files";
import { getTenancyDetail } from "@/server/landlord/units/queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { agreementCountdown } from "../../units/_lib/agreement";
import { kolkataDateOf, kolkataToday } from "../../units/_lib/dates";
import { DOCUMENT_TYPE_LABEL } from "../../units/_lib/files";
import { tenancyStanding } from "../../units/_lib/occupancy";
import { onTimeRate, orderTerms, rentChip, rentState } from "../../units/_lib/rent";
import { TenantDetail } from "./tenant-detail";
import type { TenantView } from "./view";

// L-11 · Tenant detail (spec/screens/L-11.md), a full page (D-39). Another landlord's tenancy
// renders Not found (E4-5).
export const metadata: Metadata = { title: "Tenant · RentRoll" };

export default async function TenantPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireLandlord(`/tenants/${tenantId}`);
  const db = await createSupabaseServerClient();
  const data = await getTenancyDetail(db, tenantId);
  if (!data) notFound();

  const today = kolkataToday(new Date());
  const { tenancy } = data;
  const active = tenancy.status === "active";
  const terms = orderTerms(data.terms, today);
  const urls = await readUrls(createSupabaseAdminClient(), data.documents, { download: true });

  const entries = data.rentEntries.map((e) => {
    const own = data.payments.filter((p) => p.rent_entry_id === e.id);
    const payments = own.map((p) => ({ amount: p.amount, status: p.status, receivedOn: p.received_on }));
    return { entry: e, own, record: { amountDue: e.amount_due, dueOn: e.due_on, payments } };
  });
  const term = (t: (typeof data.terms)[number]) => ({ id: t.id, startsOn: t.startsOn, endsOn: t.endsOn, rent: t.rent, rentDueDay: t.rentDueDay });

  const view: TenantView = {
    id: tenancy.id,
    name: tenancy.name,
    phone: tenancy.phone,
    email: tenancy.email,
    unitId: data.unit.id,
    unitLabel: unitLabel({ unitNumber: data.unit.unit_number, propertyName: data.property.name }),
    active,
    standing: tenancyStanding({ status: tenancy.status, noticeVacateOn: tenancy.notice_vacate_on }),
    movedInOn: tenancy.moved_in_on,
    endedOn: tenancy.ended_on,
    depositPaid: tenancy.deposit_paid,
    depositReceivedOn: tenancy.deposit_received_on,
    noticeGivenOn: tenancy.notice_given_on,
    noticeVacateOn: tenancy.notice_vacate_on,
    current: terms.current ? term(terms.current) : null,
    earlier: terms.earlier.map(term),
    upcoming: terms.upcoming.map(term),
    // The countdown is about a live agreement; an ended tenancy has nothing left to count.
    countdown: active && terms.current ? agreementCountdown(terms.current.endsOn, today) : null,
    onTime: onTimeRate(
      entries.map((e) => e.record),
      today,
    ),
    payments: entries.map(({ entry, own, record }) => {
      const state = rentState(record, today);
      return {
        id: entry.id,
        month: entry.month,
        dueOn: entry.due_on,
        amountDue: entry.amount_due,
        paid: state.paid,
        isProRata: entry.is_pro_rata,
        receipts: own
          .filter((p) => p.status === "recorded")
          .map((p) => ({ number: p.receipt_number, receivedOn: p.received_on, amount: p.amount })),
        chip: rentChip(state),
      };
    }),
    documents: data.documents.map((d) => ({
      id: d.id,
      typeLabel: DOCUMENT_TYPE_LABEL[d.type] ?? d.type,
      fileName: d.file_name,
      uploadedOn: kolkataDateOf(d.uploaded_at),
      url: urls.get(d.id) ?? null,
    })),
    today,
  };

  return <TenantDetail view={view} />;
}
