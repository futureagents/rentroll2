// In-memory TenantRepo with two landlords, for the E4 boundary tests (E4-1…E4-4, E4-8).
//
// The fake keeps the repo contract (src/server/tenant/repo.ts): tenant links resolve only while
// the tenancy is active, door tokens only while the unit has an active tenancy, and request reads
// are scoped to the token's tenancy and landlord. It is deliberately careless about what it
// returns: every hit carries the whole raw row, sentinels included, so the tests prove that the
// resolver builds its output field by field and never passes a row through.
import type {
  CreatedRequest,
  DoorHit,
  NewRequest,
  OwnRequestRow,
  RequestRow,
  TenantLinkHit,
  TenantRepo,
  TenantScope,
} from "../../src/server/tenant/repo";

/** Values that must never reach a tenant (G-2, D-30). Any of them in tenant output is a leak. */
export const SENTINELS = {
  rent: 987654,
  amountDue: 876543,
  cost: 765432,
  deposit: 654321,
  landlordEmail: "sentinel-landlord@leak.example",
  tenantEmail: "sentinel-tenant@leak.example",
  vendorId: "sentinel-vendor-id",
  internalNote: "SENTINEL internal note",
  description: "SENTINEL description of the leak",
  suggestedUrgency: "SENTINEL-urgent",
  otherTenantName: "SENTINEL Other Tenant",
  otherUnit: "SENTINEL-9Z",
  otherRequest: "R-9999",
  upi: "sentinel@okleak",
  address: "SENTINEL 1 Leak Road",
} as const;

export const T = {
  // Landlord A · Kulkarni Apartments
  aActive: "a1".repeat(20), // tenant link, active tenancy in A-2A
  aEnded: "a2".repeat(20), // tenant link, ended tenancy (previous occupant of A-2A)
  aSettled: "a3".repeat(20), // tenant link, settled tenancy (A-1B, now vacant)
  aDoorOccupied: "ad".repeat(20), // door token of A-2A (occupied)
  aDoorVacant: "ae".repeat(20), // door token of A-1B (vacant)
  // Landlord B · Shinde Residency
  bActive: "b1".repeat(20),
  bDoor: "bd".repeat(20),
} as const;

interface LandlordRow {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  upi_id: string;
  ladder_days: number[];
}
interface UnitRow {
  id: string;
  landlord_id: string;
  property: string;
  address: string;
  unit_number: string;
  rent: number;
  deposit_amount: number;
  door_token: string;
}
interface TenancyRow {
  id: string;
  landlord_id: string;
  unit_id: string;
  name: string;
  phone: string;
  email: string;
  status: "active" | "ended" | "settled";
  tenant_token: string;
  deposit_paid: number;
}
interface RequestRecord {
  id: string;
  landlord_id: string;
  unit_id: string;
  tenancy_id: string | null;
  request_number: string;
  category: RequestRow["category"];
  status: RequestRow["status"];
  created_at: string;
  reported_via: "tenant_link" | "phone" | "in_person" | "landlord";
  description: string;
  urgency: string;
  suggested_urgency: string;
  cost: number;
  vendor_id: string;
  note: string;
  photos: number;
}

export function buildWorld() {
  const landlords: LandlordRow[] = [
    { id: "L-A", name: "Anil Kulkarni", phone: "+919000000101", email: SENTINELS.landlordEmail, upi_id: SENTINELS.upi, ladder_days: [3, 10, 20] },
    { id: "L-B", name: "Bina Shinde", phone: "+919000000202", email: "b@leak.example", upi_id: "b@okleak", ladder_days: [3, 10, 20] },
  ];
  const units: UnitRow[] = [
    { id: "U-A-2A", landlord_id: "L-A", property: "Kulkarni Apartments", address: SENTINELS.address, unit_number: "2A", rent: SENTINELS.rent, deposit_amount: SENTINELS.deposit, door_token: T.aDoorOccupied },
    { id: "U-A-1B", landlord_id: "L-A", property: "Kulkarni Apartments", address: SENTINELS.address, unit_number: "1B", rent: SENTINELS.rent, deposit_amount: SENTINELS.deposit, door_token: T.aDoorVacant },
    { id: "U-A-9Z", landlord_id: "L-A", property: "Kulkarni Apartments", address: SENTINELS.address, unit_number: SENTINELS.otherUnit, rent: SENTINELS.rent, deposit_amount: SENTINELS.deposit, door_token: "a9".repeat(20) },
    { id: "U-B-G1", landlord_id: "L-B", property: "Shinde Residency", address: "B road", unit_number: "G1", rent: 10000, deposit_amount: 20000, door_token: T.bDoor },
  ];
  const tenancies: TenancyRow[] = [
    { id: "TN-A-active", landlord_id: "L-A", unit_id: "U-A-2A", name: "Priya Deshpande", phone: "+919000000303", email: SENTINELS.tenantEmail, status: "active", tenant_token: T.aActive, deposit_paid: SENTINELS.deposit },
    { id: "TN-A-ended", landlord_id: "L-A", unit_id: "U-A-2A", name: "Former Tenant", phone: "+919000000404", email: "f@leak.example", status: "ended", tenant_token: T.aEnded, deposit_paid: 1 },
    { id: "TN-A-settled", landlord_id: "L-A", unit_id: "U-A-1B", name: "Settled Tenant", phone: "+919000000505", email: "s@leak.example", status: "settled", tenant_token: T.aSettled, deposit_paid: 1 },
    { id: "TN-A-other", landlord_id: "L-A", unit_id: "U-A-9Z", name: SENTINELS.otherTenantName, phone: "+919000000606", email: "o@leak.example", status: "active", tenant_token: "a8".repeat(20), deposit_paid: 1 },
    { id: "TN-B-active", landlord_id: "L-B", unit_id: "U-B-G1", name: "Bharat Rao", phone: "+919000000707", email: "r@leak.example", status: "active", tenant_token: T.bActive, deposit_paid: 1 },
  ];
  const request = (over: Partial<RequestRecord> & Pick<RequestRecord, "id" | "landlord_id" | "unit_id" | "tenancy_id" | "request_number">): RequestRecord => ({
    category: "plumbing",
    status: "new",
    created_at: "2026-10-20T09:30:00.000Z",
    reported_via: "tenant_link",
    description: SENTINELS.description,
    urgency: "urgent",
    suggested_urgency: SENTINELS.suggestedUrgency,
    cost: SENTINELS.cost,
    vendor_id: SENTINELS.vendorId,
    note: SENTINELS.internalNote,
    photos: 2,
    ...over,
  });
  const requests: RequestRecord[] = [
    request({ id: "RQ-1", landlord_id: "L-A", unit_id: "U-A-2A", tenancy_id: "TN-A-active", request_number: "R-0001" }),
    request({ id: "RQ-2", landlord_id: "L-A", unit_id: "U-A-2A", tenancy_id: "TN-A-active", request_number: "R-0003", status: "in_progress", category: "other", created_at: "2026-10-22T09:30:00.000Z" }),
    // The former tenant's request on the same unit: never visible to the current tenant.
    request({ id: "RQ-3", landlord_id: "L-A", unit_id: "U-A-2A", tenancy_id: "TN-A-ended", request_number: "R-0002", status: "done" }),
    // Another unit's request at the same landlord.
    request({ id: "RQ-4", landlord_id: "L-A", unit_id: "U-A-9Z", tenancy_id: "TN-A-other", request_number: SENTINELS.otherRequest }),
    // Landlord B numbers its own requests from R-0001 too (D-12: per-landlord sequences).
    request({ id: "RQ-5", landlord_id: "L-B", unit_id: "U-B-G1", tenancy_id: "TN-B-active", request_number: "R-0001" }),
    request({ id: "RQ-6", landlord_id: "L-B", unit_id: "U-B-G1", tenancy_id: "TN-B-active", request_number: "R-0007" }),
  ];
  return { landlords, units, tenancies, requests };
}

export type World = ReturnType<typeof buildWorld>;

export interface FakeRepo extends TenantRepo {
  world: World;
  calls: string[];
  created: { scope: TenantScope; input: NewRequest }[];
}

export function fakeRepo(world: World = buildWorld()): FakeRepo {
  const landlord = (id: string) => world.landlords.find((l) => l.id === id)!;
  const unit = (id: string) => world.units.find((u) => u.id === id)!;
  const calls: string[] = [];
  const created: FakeRepo["created"] = [];

  // Careless on purpose: the whole raw rows ride along with the fields the contract names.
  const place = (u: UnitRow) => {
    const l = landlord(u.landlord_id);
    return {
      ...u,
      ...l,
      landlord_email: l.email,
      unitNumber: u.unit_number,
      propertyName: u.property,
      landlordName: l.name,
      landlordPhone: l.phone,
    };
  };
  const scoped = (r: RequestRecord, scope: TenantScope) =>
    r.tenancy_id === scope.tenancyId && r.landlord_id === scope.landlordId;
  const requestRow = (r: RequestRecord) => ({
    ...r,
    requestNumber: r.request_number,
    category: r.category,
    status: r.status,
    createdAt: r.created_at,
  });

  let nextNumber = 100;

  return {
    world,
    calls,
    created,
    async findTenantLink(token) {
      calls.push("findTenantLink");
      const t = world.tenancies.find((x) => x.tenant_token === token && x.status === "active");
      if (!t) return null;
      return {
        ...t,
        ...place(unit(t.unit_id)),
        scope: { landlordId: t.landlord_id, unitId: t.unit_id, tenancyId: t.id },
        name: t.name,
        phone: t.phone,
      } as TenantLinkHit;
    },
    async findDoor(token) {
      calls.push("findDoor");
      const u = world.units.find((x) => x.door_token === token);
      if (!u) return null;
      const t = world.tenancies.find((x) => x.unit_id === u.id && x.status === "active");
      if (!t) return null;
      return {
        ...t,
        ...place(u),
        scope: { landlordId: u.landlord_id, unitId: u.id, tenancyId: t.id },
      } as DoorHit;
    },
    async listRequests(scope) {
      calls.push("listRequests");
      return world.requests.filter((r) => scoped(r, scope)).map(requestRow) as RequestRow[];
    },
    async findRequest(scope, requestNumber) {
      calls.push("findRequest");
      const r = world.requests.find((x) => scoped(x, scope) && x.request_number === requestNumber);
      return r ? ({ ...requestRow(r), photoCount: r.photos } as OwnRequestRow) : null;
    },
    async countTenantLinkRequestsSince(scope, since) {
      calls.push("countTenantLinkRequestsSince");
      return world.requests.filter(
        (r) => scoped(r, scope) && r.reported_via === "tenant_link" && new Date(r.created_at) >= since,
      ).length;
    },
    async createRequest(scope, input): Promise<CreatedRequest> {
      calls.push("createRequest");
      created.push({ scope, input });
      nextNumber += 1;
      const requestNumber = `R-0${nextNumber}`;
      const id = `RQ-new-${nextNumber}`;
      world.requests.push({
        id,
        landlord_id: scope.landlordId,
        unit_id: scope.unitId,
        tenancy_id: scope.tenancyId,
        request_number: requestNumber,
        category: input.report.category,
        status: "new",
        created_at: new Date().toISOString(),
        reported_via: "tenant_link",
        description: input.report.description,
        urgency: input.report.urgency,
        suggested_urgency: "",
        cost: 0,
        vendor_id: "",
        note: "",
        photos: input.photos.length,
      });
      return { requestNumber };
    },
  };
}

/** Adds `n` tenant-link requests made `minutesAgo` minutes before `now` to the tenancy. */
export function addRecentRequests(world: World, tenancyId: string, n: number, now: Date, minutesAgo = 10) {
  const t = world.tenancies.find((x) => x.id === tenancyId)!;
  for (let i = 0; i < n; i++) {
    world.requests.push({
      ...world.requests[0],
      id: `RQ-recent-${tenancyId}-${minutesAgo}-${i}`,
      landlord_id: t.landlord_id,
      unit_id: t.unit_id,
      tenancy_id: t.id,
      request_number: `R-8${minutesAgo}${i}`,
      created_at: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
    });
  }
}
