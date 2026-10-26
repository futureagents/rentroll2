// In-memory stand-in for the Supabase client, enough for src/server/landlord/units. It behaves
// like the landlord's RLS-scoped client: every read, update and delete sees only rows whose
// landlord_id is the signed-in landlord's, and inserts are stamped with it (schema §9, D-04).
// Deleting a tenancy or a property cascades as the schema's foreign keys do. Storage is a map of
// path → { contentType, size }.
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

const CASCADE: Record<string, { table: string; column: string }[]> = {
  property: [{ table: "unit", column: "property_id" }],
  unit: [
    { table: "tenancy", column: "unit_id" },
    { table: "document", column: "unit_id" },
  ],
  tenancy: [
    { table: "agreement", column: "tenancy_id" },
    { table: "rent_entry", column: "tenancy_id" },
    { table: "document", column: "tenancy_id" },
  ],
};

export interface Fake {
  db: SupabaseClient;
  admin: SupabaseClient;
  tables: Record<string, Row[]>;
  objects: Map<string, { contentType: string; size: number }>;
  removed: string[];
  /** Make the next insert/upsert/update on `table` fail. */
  failNext: (table: string, code?: string) => void;
}

export function fakeSupabase(landlordId: string, seed: Record<string, Row[]> = {}): Fake {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }));
  const objects = new Map<string, { contentType: string; size: number }>();
  const removed: string[] = [];
  const failures = new Map<string, string>();
  let ids = 0;
  const table = (name: string) => (tables[name] ??= []);
  const visible = (row: Row) => row.landlord_id === landlordId;

  function cascadeDelete(name: string, row: Row) {
    for (const child of CASCADE[name] ?? []) {
      for (const r of table(child.table).filter((c) => c[child.column] === row.id)) cascadeDelete(child.table, r);
      tables[child.table] = table(child.table).filter((c) => c[child.column] !== row.id);
    }
  }

  function query(name: string) {
    const filters: Filter[] = [];
    let action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
    let payload: Row | Row[] | undefined;
    let upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } | undefined;
    let head = false;
    let single: "one" | "maybe" | null = null;

    const run = () => {
      if (action !== "select" && action !== "delete" && failures.has(name)) {
        const code = failures.get(name);
        failures.delete(name);
        return { data: null, error: { message: "forced failure", code }, count: null };
      }
      let result: Row[] = [];
      if (action === "select") {
        result = table(name).filter((r) => visible(r) && filters.every((f) => f(r)));
      } else if (action === "insert" || action === "upsert") {
        const rows = (Array.isArray(payload) ? payload : [payload]) as Row[];
        for (const input of rows) {
          const row: Row = { id: input.id ?? `${name}-${++ids}`, landlord_id: landlordId, ...input };
          if (name === "tenancy") row.tenant_token ??= `token-${ids}`;
          if (name === "unit") row.door_token ??= `door-${ids}`;
          if (name === "tenancy") row.status ??= "active";
          if (action === "upsert" && upsertOptions?.onConflict) {
            const keys = upsertOptions.onConflict.split(",");
            if (table(name).some((r) => keys.every((k) => r[k] === row[k]))) continue;
          }
          table(name).push(row);
          result.push(row);
        }
      } else if (action === "update") {
        for (const r of table(name)) {
          if (visible(r) && filters.every((f) => f(r))) {
            Object.assign(r, payload);
            result.push(r);
          }
        }
      } else {
        const doomed = table(name).filter((r) => visible(r) && filters.every((f) => f(r)));
        for (const r of doomed) cascadeDelete(name, r);
        tables[name] = table(name).filter((r) => !doomed.includes(r));
        result = doomed;
      }
      const data = single ? (result[0] ?? null) : head ? null : result;
      if (single === "one" && !result[0]) return { data: null, error: { message: "no rows" }, count: null };
      return { data, error: null, count: result.length };
    };

    const builder = {
      select(_columns?: string, options?: { count?: string; head?: boolean }) {
        if (options?.head) head = true;
        return builder;
      },
      insert(p: Row | Row[]) {
        action = "insert";
        payload = p;
        return builder;
      },
      upsert(p: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        action = "upsert";
        payload = p;
        upsertOptions = options;
        return builder;
      },
      update(p: Row) {
        action = "update";
        payload = p;
        return builder;
      },
      delete() {
        action = "delete";
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push((r) => r[column] === value);
        return builder;
      },
      in(column: string, values: unknown[]) {
        filters.push((r) => values.includes(r[column]));
        return builder;
      },
      order() {
        return builder;
      },
      maybeSingle() {
        single = "maybe";
        return builder;
      },
      single() {
        single = "one";
        return builder;
      },
      then<T>(resolve: (value: ReturnType<typeof run>) => T, reject?: (reason: unknown) => T) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return builder;
  }

  const storage = {
    from: () => ({
      info: async (path: string) => {
        const object = objects.get(path);
        return object ? { data: { contentType: object.contentType, size: object.size }, error: null } : { data: null, error: { message: "not found" } };
      },
      remove: async (paths: string[]) => {
        for (const p of paths) {
          objects.delete(p);
          removed.push(p);
        }
        return { data: [], error: null };
      },
      createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://storage.test/upload/${path}?token=t`, token: "t", path }, error: null }),
    }),
  };

  const db = { from: query } as unknown as SupabaseClient;
  const admin = { from: query, storage } as unknown as SupabaseClient;
  return { db, admin, tables, objects, removed, failNext: (t, code) => failures.set(t, code ?? "XX000") };
}
