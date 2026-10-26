// Fixtures for the /dev/units preview: Anil Kulkarni's two buildings from the demo seed.
import type { UnitRegisterProps } from "@/app/(landlord)/units/units-register";
import type { UnitView } from "@/app/(landlord)/units/[unitId]/view";
import type { TenantListRow } from "@/app/(landlord)/tenants/tenant-list";
import type { TenantView } from "@/app/(landlord)/tenants/[tenantId]/view";

const active = { status: "active" as const, noticeVacateOn: null };

export const unitRegister: Pick<UnitRegisterProps, "properties" | "units"> = {
  properties: [
    { id: "p-k", name: "Kulkarni Apartments" },
    { id: "p-s", name: "Shanti Niwas" },
  ],
  units: [
    { id: "u-1a", propertyId: "p-k", propertyName: "Kulkarni Apartments", unitNumber: "1A", type: "1BHK", rent: 16000, deposit: 48000, tenantName: "Rohit Sharma", activeTenancy: active },
    { id: "u-2a", propertyId: "p-k", propertyName: "Kulkarni Apartments", unitNumber: "2A", type: "2BHK", rent: 18000, deposit: 54000, tenantName: "Meera Desai", activeTenancy: active },
    { id: "u-4c", propertyId: "p-k", propertyName: "Kulkarni Apartments", unitNumber: "4C", type: "2BHK", rent: 18000, deposit: 54000, tenantName: "Suresh Khan", activeTenancy: { status: "active", noticeVacateOn: "2026-11-30" } },
    { id: "u-10a", propertyId: "p-k", propertyName: "Kulkarni Apartments", unitNumber: "10A", type: "3BHK", rent: 26000, deposit: 78000, tenantName: null, activeTenancy: null },
    { id: "u-g1", propertyId: "p-s", propertyName: "Shanti Niwas", unitNumber: "G1", type: "1RK", rent: 10000, deposit: 20000, tenantName: "Kavya Rao", activeTenancy: active },
    { id: "u-1a-s", propertyId: "p-s", propertyName: "Shanti Niwas", unitNumber: "1A", type: "1RK", rent: 11000, deposit: 22000, tenantName: null, activeTenancy: null },
  ],
};

export const unitView: UnitView = {
  id: "u-2a",
  unitNumber: "2A",
  label: "Flat 2A, Kulkarni Apartments",
  propertyId: "p-k",
  propertyName: "Kulkarni Apartments",
  propertyAddress: "12 Paud Road, Kothrud, Pune 411038",
  type: "2BHK",
  askingRent: 18000,
  askingDeposit: 54000,
  rent: 18500,
  occupancy: "occupied",
  current: {
    tenancyId: "t-meera",
    name: "Meera Desai",
    phone: "+919000000103",
    movedInOn: "2024-04-01",
    agreementEndsOn: "2026-12-31",
    depositPaid: 54000,
    noticeVacateOn: null,
    tenantLink: "http://localhost:3000/u/0f3a9c1d2e4b5a6978c0d1e2f3a4b5c6d7e8f901",
    moveInPhotoCount: 0,
  },
  doorLink: "http://localhost:3000/u/9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b",
  linkProblem: null,
  figures: {
    lifetime: { collected: 512000, spend: 34000, net: 478000 },
    lastTwelveMonths: { collected: 210000, spend: 12500, net: 197500 },
  },
  historySince: "2023-05-01",
  rentRows: [
    { id: "r1", month: "2026-10-01", tenantName: "Meera Desai", amountDue: 18500, paid: 14000, isProRata: false, chip: { tone: "danger", label: "21 days late", sub: "Part paid — ₹4,500 pending" } },
    { id: "r2", month: "2026-09-01", tenantName: "Meera Desai", amountDue: 18500, paid: 18500, isProRata: false, chip: { tone: "success", label: "Paid", sub: null } },
    { id: "r3", month: "2024-04-01", tenantName: "Meera Desai", amountDue: 18000, paid: 18000, isProRata: false, chip: { tone: "success", label: "Paid", sub: null } },
    { id: "r4", month: "2023-05-01", tenantName: "Arjun Mehta", amountDue: 9290, paid: 9290, isProRata: true, chip: { tone: "success", label: "Paid", sub: null } },
  ],
  requests: [
    { id: "q1", number: "R-0412", reportedOn: "2026-10-20", category: "Plumbing", status: { tone: "warning", label: "In progress" }, cost: null, noCost: false, done: false, description: "Geyser is leaking from the bottom" },
    { id: "q2", number: "R-0390", reportedOn: "2026-06-02", category: "Plumbing", status: { tone: "success", label: "Done" }, cost: 2500, noCost: false, done: true, description: "Kitchen tap drips" },
    { id: "q3", number: "R-0371", reportedOn: "2026-02-11", category: "Plumbing", status: { tone: "success", label: "Done" }, cost: null, noCost: true, done: true, description: "Bathroom drain slow" },
  ],
  repeatNotes: ["Plumbing reported 3 times in 12 months."],
  moveIn: [
    { tenancyId: "t-meera", tenantName: "Meera Desai", movedInOn: "2024-04-01", endedOn: null, active: true, photos: [] },
    { tenancyId: "t-arjun", tenantName: "Arjun Mehta", movedInOn: "2023-05-10", endedOn: "2024-03-15", active: false, photos: [] },
  ],
  repairs: [],
  documents: [{ id: "d1", typeLabel: "Agreement", fileName: "agreement-2a-2025.pdf", tenantName: "Meera Desai", uploadedOn: "2025-04-01", url: "#" }],
  canDelete: false,
  siblings: [],
  today: "2026-10-26",
};

export const tenantList: TenantListRow[] = [
  { id: "t-rohit", name: "Rohit Sharma", phone: "+919000000101", unitNumber: "1A", propertyName: "Kulkarni Apartments", status: "active", noticeVacateOn: null, agreementEndsOn: "2027-03-31" },
  { id: "t-meera", name: "Meera Desai", phone: "+919000000103", unitNumber: "2A", propertyName: "Kulkarni Apartments", status: "active", noticeVacateOn: null, agreementEndsOn: "2026-12-31" },
  { id: "t-suresh", name: "Suresh Khan", phone: "+919000000108", unitNumber: "4C", propertyName: "Kulkarni Apartments", status: "active", noticeVacateOn: "2026-11-30", agreementEndsOn: "2027-01-31" },
  { id: "t-kavya", name: "Kavya Rao", phone: "+919000000112", unitNumber: "G1", propertyName: "Shanti Niwas", status: "active", noticeVacateOn: null, agreementEndsOn: "2026-11-15" },
  { id: "t-arjun", name: "Arjun Mehta", phone: "+919000000113", unitNumber: "2A", propertyName: "Kulkarni Apartments", status: "settled", noticeVacateOn: null, agreementEndsOn: "2024-04-30" },
];

export const tenantView: TenantView = {
  id: "t-meera",
  name: "Meera Desai",
  phone: "+919000000103",
  email: "meera.desai@example.com",
  unitId: "u-2a",
  unitLabel: "Flat 2A, Kulkarni Apartments",
  active: true,
  standing: "current",
  movedInOn: "2024-04-01",
  endedOn: null,
  depositPaid: 54000,
  depositReceivedOn: "2024-03-28",
  noticeGivenOn: null,
  noticeVacateOn: null,
  current: { id: "a3", startsOn: "2026-01-01", endsOn: "2026-12-31", rent: 18500, rentDueDay: 5 },
  earlier: [
    { id: "a2", startsOn: "2025-04-01", endsOn: "2025-12-31", rent: 18000, rentDueDay: 5 },
    { id: "a1", startsOn: "2024-04-01", endsOn: "2025-03-31", rent: 17000, rentDueDay: 5 },
  ],
  upcoming: [],
  countdown: { tone: "warning", label: "Ends in 66 days" },
  onTime: { onTime: 10, counted: 12, percent: 83 },
  payments: [
    { id: "r1", month: "2026-10-01", dueOn: "2026-10-05", amountDue: 18500, paid: 14000, isProRata: false, receipts: [{ number: "RR-0847", receivedOn: "2026-10-05", amount: 14000 }], chip: { tone: "danger", label: "21 days late", sub: "Part paid — ₹4,500 pending" } },
    { id: "r2", month: "2026-09-01", dueOn: "2026-09-05", amountDue: 18500, paid: 18500, isProRata: false, receipts: [{ number: "RR-0821", receivedOn: "2026-09-04", amount: 18500 }], chip: { tone: "success", label: "Paid", sub: null } },
  ],
  documents: [{ id: "d1", typeLabel: "Agreement", fileName: "agreement-2a-2025.pdf", uploadedOn: "2025-04-01", url: "https://example.com/agreement.pdf" }],
  today: "2026-10-26",
};
