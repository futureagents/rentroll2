// In-memory stand-in for the Supabase query builder, enough for the rent server module.
// It applies the schema rules the rent code relies on (supabase/migrations/…_rentroll_schema.sql):
// unique (tenancy_id, month) on rent_entry with ON CONFLICT DO NOTHING, per-landlord receipt
// numbers allocated at insert (D-12), and it refuses deletes on payment and audit_event
// (D-11, D-14). Every operation is logged so tests can assert what was, and was not, sent.
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export interface Op {
  table: string;
  action: "select" | "insert" | "upsert" | "update" | "delete";
  payload?: unknown;
  options?: unknown;
}

export interface FakeDb {
  client: SupabaseClient;
  tables: Record<string, Row[]>;
  ops: Op[];
  /** Make the next mutation on `table` fail with this message. */
  failNext: (table: string, message: string) => void;
}

const UNIQUE_KEYS: Record<string, string[]> = { rent_entry: ["tenancy_id", "month"] };

export function fakeDb(seed: Record<string, Row[]> = {}): FakeDb {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }));
  const ops: Op[] = [];
  const failures: Record<string, string> = {};
  let ids = 0;
  let receipt = 846;

  const table = (name: string) => (tables[name] ??= []);

  function builder(name: string) {
    const filters: Filter[] = [];
    let action: Op["action"] = "select";
    let payload: Row[] | Row | undefined;
    let options: { onConflict?: string; ignoreDuplicates?: boolean } | undefined;
    let returning = false;
    let single: "one" | "maybe" | null = null;

    const run = (): { data: unknown; error: { message: string } | null } => {
      ops.push({ table: name, action, payload, options });
      if (action !== "select" && failures[name]) {
        const message = failures[name];
        delete failures[name];
        return { data: null, error: { message } };
      }
      let result: Row[] = [];
      if (action === "select") {
        result = table(name).filter((r) => filters.every((f) => f(r)));
      } else if (action === "insert" || action === "upsert") {
        const rows = (Array.isArray(payload) ? payload : [payload]) as Row[];
        const key = UNIQUE_KEYS[name];
        for (const input of rows) {
          const row: Row = { id: `${name}-${++ids}`, created_at: new Date(2026, 9, 26).toISOString(), ...input };
          if (key && table(name).some((r) => key.every((k) => r[k] === row[k]))) {
            if (action === "upsert" && options?.ignoreDuplicates) continue;
            return { data: null, error: { message: `duplicate key value violates unique constraint (${key.join(", ")})` } };
          }
          if (name === "payment") {
            row.receipt_number = `RR-${String(++receipt).padStart(4, "0")}`;
            row.status ??= "recorded";
          }
          table(name).push(row);
          result.push(row);
        }
      } else if (action === "update") {
        result = table(name).filter((r) => filters.every((f) => f(r)));
        for (const r of result) Object.assign(r, payload);
      } else if (action === "delete") {
        if (name === "payment" || name === "audit_event") {
          return { data: null, error: { message: `${name} rows are never deleted` } };
        }
        result = table(name).filter((r) => filters.every((f) => f(r)));
        tables[name] = table(name).filter((r) => !result.includes(r));
      }
      const data = action === "select" || returning ? result.map((r) => ({ ...r })) : null;
      if (single === "one") return data && (data as Row[]).length === 1 ? { data: (data as Row[])[0], error: null } : { data: null, error: { message: "not found" } };
      if (single === "maybe") return { data: (data as Row[] | null)?.[0] ?? null, error: null };
      return { data, error: null };
    };

    const api = {
      select() {
        if (action !== "select") returning = true;
        return api;
      },
      insert(rows: Row[] | Row) {
        action = "insert";
        payload = rows;
        return api;
      },
      upsert(rows: Row[] | Row, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        action = "upsert";
        payload = rows;
        options = opts;
        return api;
      },
      update(values: Row) {
        action = "update";
        payload = values;
        return api;
      },
      delete() {
        action = "delete";
        return api;
      },
      eq(column: string, value: unknown) {
        filters.push((r) => r[column] === value);
        return api;
      },
      in(column: string, values: unknown[]) {
        filters.push((r) => values.includes(r[column]));
        return api;
      },
      lte(column: string, value: string) {
        filters.push((r) => String(r[column]) <= value);
        return api;
      },
      gte(column: string, value: string) {
        filters.push((r) => String(r[column]) >= value);
        return api;
      },
      order() {
        return api;
      },
      single() {
        single = "one";
        return api;
      },
      maybeSingle() {
        single = "maybe";
        return api;
      },
      then<T>(resolve: (value: ReturnType<typeof run>) => T, reject?: (reason: unknown) => T) {
        return Promise.resolve().then(run).then(resolve, reject);
      },
    };
    return api;
  }

  const client = { from: (name: string) => builder(name) } as unknown as SupabaseClient;
  return { client, tables, ops, failNext: (name, message) => void (failures[name] = message) };
}
