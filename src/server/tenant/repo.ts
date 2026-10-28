import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CheckedPhoto } from "@/lib/tenant/photos";
import { LANDLORD_CATEGORY_LABEL, type Category, type RequestStatus, type ValidReport } from "@/lib/tenant/report";

import { SELECT } from "./columns";

// The tenant side's whole conversation with the database (D-04). Reads use the SELECT strings in
// columns.ts and are filtered by the resolved landlord and tenancy; the one write is T-01's
// request with its photos. Hits are built field by field from the response, never passed through.
// The service-role client bypasses RLS, so these filters are the boundary.

/** D-04: what a token resolves to. Server-only; never rendered or sent to the browser. */
export interface TenantScope {
  landlordId: string;
  unitId: string;
  tenancyId: string;
}

interface PlaceFields {
  unitNumber: string;
  propertyName: string;
  landlordName: string;
  landlordPhone: string | null;
}

export interface TenantLinkHit extends PlaceFields {
  scope: TenantScope;
  name: string;
  phone: string;
}

export interface DoorHit extends PlaceFields {
  scope: TenantScope;
}

export interface RequestRow {
  requestNumber: string;
  category: Category;
  status: RequestStatus;
  createdAt: string;
}

export interface OwnRequestRow extends RequestRow {
  photoCount: number;
}

export interface NewRequest {
  report: ValidReport;
  photos: CheckedPhoto[];
}

export interface CreatedRequest {
  requestNumber: string;
}

export interface TenantRepo {
  /** D-01/D-05: a tenant link resolves only while its tenancy is active. */
  findTenantLink(token: string): Promise<TenantLinkHit | null>;
  /** D-01/D-02: a door token resolves only while its unit has an active tenancy. */
  findDoor(token: string): Promise<DoorHit | null>;
  listRequests(scope: TenantScope): Promise<RequestRow[]>;
  findRequest(scope: TenantScope, requestNumber: string): Promise<OwnRequestRow | null>;
  countTenantLinkRequestsSince(scope: TenantScope, since: Date): Promise<number>;
  createRequest(scope: TenantScope, input: NewRequest): Promise<CreatedRequest>;
}

const BUCKET = "documents"; // D-15 private bucket
const PHOTO_TYPE = "request_before_photo";

class TenantQueryError extends Error {
  constructor(step: string, code: string | undefined) {
    // The step and Postgres code only: messages can quote row values.
    super(`tenant ${step}: ${code ?? "unknown"}`);
  }
}

export function check<T extends { error: { code?: string } | null }>(step: string, result: T): T {
  if (result.error) throw new TenantQueryError(step, result.error.code);
  return result;
}

export const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
export const one = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function place(unitNumber: unknown, property: unknown, landlord: unknown): PlaceFields | null {
  const p = one(property);
  const l = one(landlord);
  if (!str(unitNumber) || !p || !l) return null;
  return {
    unitNumber: str(unitNumber),
    propertyName: str(p.name),
    landlordName: str(l.name),
    landlordPhone: strOrNull(l.phone),
  };
}

function requestRow(row: Record<string, unknown>): RequestRow {
  return {
    requestNumber: str(row.request_number),
    category: str(row.category) as Category,
    status: str(row.status) as RequestStatus,
    createdAt: str(row.created_at),
  };
}

export function createSupabaseTenantRepo(
  client: SupabaseClient,
  { newId = () => crypto.randomUUID() }: { newId?: () => string } = {},
): TenantRepo {
  return {
    async findTenantLink(token) {
      const { data } = check(
        "tenant link",
        await client
          .from("tenancy")
          .select(SELECT.tenantLink)
          .eq("tenant_token", token)
          .eq("status", "active")
          .maybeSingle(),
      );
      const row = one(data);
      if (!row) return null;
      const unit = one(row.unit);
      const fields = unit && place(unit.unit_number, unit.property, row.landlord);
      if (!fields || !str(row.id) || !str(row.landlord_id) || !str(row.unit_id)) return null;
      return {
        scope: { landlordId: str(row.landlord_id), unitId: str(row.unit_id), tenancyId: str(row.id) },
        name: str(row.name),
        phone: str(row.phone),
        ...fields,
      };
    },

    async findDoor(token) {
      const { data } = check(
        "door token",
        await client
          .from("unit")
          .select(SELECT.door)
          .eq("door_token", token)
          .eq("tenancy.status", "active")
          .maybeSingle(),
      );
      const row = one(data);
      if (!row) return null;
      // D-05 allows one active tenancy per unit; anything else is treated as vacant.
      const tenancies = Array.isArray(row.tenancy) ? row.tenancy : [];
      const tenancy = tenancies.length === 1 ? one(tenancies[0]) : null;
      const fields = place(row.unit_number, row.property, row.landlord);
      if (!tenancy || !str(tenancy.id) || !fields || !str(row.id) || !str(row.landlord_id)) return null;
      return {
        scope: { landlordId: str(row.landlord_id), unitId: str(row.id), tenancyId: str(tenancy.id) },
        ...fields,
      };
    },

    async listRequests(scope) {
      const { data } = check(
        "requests",
        await client
          .from("request")
          .select(SELECT.requests)
          .eq("landlord_id", scope.landlordId)
          .eq("tenancy_id", scope.tenancyId)
          .order("created_at", { ascending: false }),
      );
      return (Array.isArray(data) ? (data as unknown[]) : []).flatMap((row) => {
        const record = one(row);
        return record ? [requestRow(record)] : [];
      });
    },

    async findRequest(scope, requestNumber) {
      const { data } = check(
        "own request",
        await client
          .from("request")
          .select(SELECT.ownRequest)
          .eq("landlord_id", scope.landlordId)
          .eq("tenancy_id", scope.tenancyId)
          .eq("request_number", requestNumber)
          .maybeSingle(),
      );
      const row = one(data);
      if (!row || !str(row.id)) return null;
      const { count } = check(
        "photo count",
        await client
          .from("document")
          .select(SELECT.countOnly, { count: "exact", head: true })
          .eq("landlord_id", scope.landlordId)
          .eq("request_id", str(row.id))
          .eq("type", PHOTO_TYPE),
      );
      return { ...requestRow(row), photoCount: count ?? 0 };
    },

    async countTenantLinkRequestsSince(scope, since) {
      const { count } = check(
        "rate limit",
        await client
          .from("request")
          .select(SELECT.countOnly, { count: "exact", head: true })
          .eq("landlord_id", scope.landlordId)
          .eq("tenancy_id", scope.tenancyId)
          .eq("reported_via", "tenant_link")
          .gte("created_at", since.toISOString()),
      );
      return count ?? 0;
    },

    // T-01: photos first (so a request never exists without the photos the tenant attached), then
    // the request, then its photo rows. Each step undoes the earlier ones if it is refused.
    // PROMOTE: one transactional RPC (lane/schema) would replace the compensation below.
    async createRequest(scope, { report, photos }) {
      const storage = client.storage.from(BUCKET);
      const files = photos.map((photo) => {
        const id = newId();
        return { id, path: `${scope.landlordId}/${id}`, photo }; // D-15 <landlord_id>/<document_id>
      });
      const removeFiles = async () => {
        if (files.length) await storage.remove(files.map((f) => f.path));
      };

      try {
        for (const file of files) {
          const { error } = await storage.upload(file.path, file.photo.bytes, {
            contentType: file.photo.mime,
            upsert: false,
          });
          if (error) throw new TenantQueryError("photo upload", undefined);
        }
      } catch (error) {
        await removeFiles();
        throw error;
      }

      let created: { id: string; requestNumber: string };
      try {
        const { data } = check(
          "request insert",
          await client
            .from("request")
            .insert({
              landlord_id: scope.landlordId,
              unit_id: scope.unitId,
              tenancy_id: scope.tenancyId,
              reported_via: "tenant_link", // D-29
              reporter_name: report.name,
              reporter_phone: report.phone,
              description: report.description,
              reported_category: report.category, // D-21: the tenant's choice; the triggers copy it
              reported_urgency: report.urgency, //  into the effective columns and number the request
            })
            .select(SELECT.created)
            .single(),
        );
        const row = one(data);
        if (!row || !str(row.id) || !str(row.request_number)) throw new TenantQueryError("request insert", "no row");
        created = { id: str(row.id), requestNumber: str(row.request_number) };
      } catch (error) {
        await removeFiles();
        throw error;
      }

      if (files.length) {
        try {
          check(
            "photo rows",
            await client.from("document").insert(
              files.map((file, i) => ({
                id: file.id,
                landlord_id: scope.landlordId,
                unit_id: scope.unitId,
                tenancy_id: scope.tenancyId,
                request_id: created.id,
                type: PHOTO_TYPE,
                storage_path: file.path,
                file_name: `${created.requestNumber}-photo-${i + 1}.${file.photo.extension}`,
                mime: file.photo.mime,
                size_bytes: file.photo.bytes.byteLength,
                // E5: meaningful alternative text, read by the landlord on L-07.
                alt_text: `Photo ${i + 1} of ${files.length} from tenant report ${created.requestNumber} (${LANDLORD_CATEGORY_LABEL[report.category]})`,
                uploaded_by: "tenant",
              })),
            ),
          );
        } catch (error) {
          await client.from("request").delete().eq("id", created.id).eq("landlord_id", scope.landlordId);
          await removeFiles();
          throw error;
        }
      }

      return { requestNumber: created.requestNumber };
    },
  };
}
