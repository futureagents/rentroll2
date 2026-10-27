import "server-only";

// D-30: the complete tenant-readable column set, and every select string tenant code may send.
// Nothing in src/server/tenant passes its own column list to Supabase: each read uses one of the
// SELECT strings below, and each column in them comes through `pick`, which refuses anything not
// in TENANT_COLUMNS. tests/tenant/e4-4-allowlist.test.ts pins TENANT_COLUMNS to D-30 and
// tests/tenant/repo-queries.test.ts checks every SELECT against it.

const frozen = <T extends Record<string, readonly string[]>>(columns: T): T => {
  for (const list of Object.values(columns)) Object.freeze(list);
  return Object.freeze(columns);
};

export const TENANT_COLUMNS = frozen({
  tenancy: ["name", "phone", "moved_in_on"], // phone for pre-fill only; current agreement below
  agreement: ["starts_on", "ends_on"],
  unit: ["unit_number", "type"],
  property: ["name"],
  landlord: ["name", "receipt_name", "phone", "logo_document_id"],
  request: ["request_number", "category", "created_at", "status"], // category is the effective one (D-21)
  message: ["body"], // latest confirmed tenant_update only (D-17)
  audit_event: ["new_value", "created_at"], // kind = status_change only
  payment: ["amount", "received_on", "reference", "receipt_number"], // own tenancy, recorded only (D-26)
  rent_entry: ["month"], // the payment's month; never amount_due (D-26)
} as const);

type Table = keyof typeof TENANT_COLUMNS;

/**
 * The scoping ids (D-04 `{landlord_id, unit_id, tenancy_id}` and a request's own id for its photo
 * count). Read to scope later queries; never placed in anything rendered.
 */
export const SCOPE_KEYS = ["id", "landlord_id", "unit_id"] as const;

function pick<T extends Table>(table: T, ...columns: (typeof TENANT_COLUMNS)[T][number][]): string {
  const allowed: readonly string[] = TENANT_COLUMNS[table];
  for (const column of columns) {
    if (!allowed.includes(column)) throw new Error(`D-30: ${table}.${column} is not tenant-readable`);
  }
  return columns.join(", ");
}

// Embeds name their foreign key: several tables (request, rent_entry, agreement) link the same
// pairs, so PostgREST would otherwise refuse the embed as ambiguous.
export const SELECT = Object.freeze({
  /** D-01 tenant link → its tenancy, unit, property, landlord. Filtered to status = active. */
  tenantLink:
    `id, landlord_id, unit_id, ${pick("tenancy", "name", "phone")}, ` +
    `unit:unit!tenancy_unit_id_landlord_id_fkey!inner(${pick("unit", "unit_number")}, ` +
    `property:property!unit_property_id_landlord_id_fkey!inner(${pick("property", "name")})), ` +
    `landlord:landlord!tenancy_landlord_id_fkey!inner(${pick("landlord", "name", "phone")})`,
  /** D-01 door token → its unit, property, landlord, and the unit's active tenancy (id only, D-02). */
  door:
    `id, landlord_id, ${pick("unit", "unit_number")}, ` +
    `property:property!unit_property_id_landlord_id_fkey!inner(${pick("property", "name")}), ` +
    `landlord:landlord!unit_landlord_id_fkey!inner(${pick("landlord", "name", "phone")}), ` +
    `tenancy:tenancy!tenancy_unit_id_landlord_id_fkey!inner(id)`,
  /** Own requests (D-30). */
  requests: pick("request", "request_number", "category", "status", "created_at"),
  /** One own request for T-02, with its id for the photo count. */
  ownRequest: `id, ${pick("request", "request_number", "category", "status", "created_at")}`,
  /** What the T-01 insert reads back. */
  created: `id, ${pick("request", "request_number")}`,
  /** Head-only counts (rate limit, photo count): no row content is returned. */
  countOnly: "id",
  /** T03-TML-ITEM: `status_change` rows of one own request (D-30). */
  statusChanges: pick("audit_event", "new_value", "created_at"),
  /** T03-LST-REPORTS "the landlord's latest update": latest confirmed `tenant_update` body (D-17). */
  latestUpdate: pick("message", "body"),
  /** T04-SEC-UNIT agreement start and end dates. Never `rent` (T-04 "No rent figure"). */
  agreements: pick("agreement", "starts_on", "ends_on"),
  /** T05-LST-RECEIPTS: own recorded payments with their month (D-26). Never `amount_due`. */
  receipts:
    `${pick("payment", "amount", "receipt_number")}, ` +
    `rent_entry:rent_entry!payment_rent_entry_id_tenancy_id_fkey!inner(${pick("rent_entry", "month")})`,
});
