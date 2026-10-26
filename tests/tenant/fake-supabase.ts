// A recording stand-in for the service-role Supabase client, enough for src/server/tenant/repo.ts.
// Every query is captured (table, op, select string, filters, payload) and answered by a responder,
// so tests can assert exactly what the real repository asks the database for.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Query {
  table: string;
  op: "select" | "insert" | "delete";
  select?: string;
  selectOptions?: { count?: string; head?: boolean };
  filters: [op: string, column: string, value: unknown][];
  order?: [column: string, options: unknown];
  payload?: unknown;
  single?: "single" | "maybeSingle";
}

export interface Upload {
  bucket: string;
  path: string;
  contentType?: string;
  upsert?: boolean;
  size: number;
}

export interface Answer {
  data?: unknown;
  error?: { code: string; message: string } | null;
  count?: number | null;
}

export type Responder = (query: Query) => Answer;

export function fakeSupabase(respond: Responder, storage: { failUpload?: (path: string) => boolean } = {}) {
  const queries: Query[] = [];
  const uploads: Upload[] = [];
  const removed: string[][] = [];

  class Builder implements PromiseLike<Answer> {
    constructor(private readonly query: Query) {}
    select(columns: string, options?: { count?: string; head?: boolean }) {
      this.query.select = columns;
      if (options) this.query.selectOptions = options;
      return this;
    }
    insert(payload: unknown) {
      this.query.op = "insert";
      this.query.payload = payload;
      return this;
    }
    delete() {
      this.query.op = "delete";
      return this;
    }
    eq(column: string, value: unknown) {
      this.query.filters.push(["eq", column, value]);
      return this;
    }
    gte(column: string, value: unknown) {
      this.query.filters.push(["gte", column, value]);
      return this;
    }
    order(column: string, options?: unknown) {
      this.query.order = [column, options];
      return this;
    }
    maybeSingle() {
      this.query.single = "maybeSingle";
      return this;
    }
    single() {
      this.query.single = "single";
      return this;
    }
    then<A = Answer, B = never>(
      onFulfilled?: ((value: Answer) => A | PromiseLike<A>) | null,
      onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      queries.push(this.query);
      const answer = { data: null, error: null, count: null, ...respond(this.query) };
      return Promise.resolve(answer).then(onFulfilled, onRejected);
    }
  }

  const client = {
    from(table: string) {
      return new Builder({ table, op: "select", filters: [] });
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, body: Blob | Uint8Array, options?: { contentType?: string; upsert?: boolean }) {
            const size = body instanceof Uint8Array ? body.byteLength : (body as Blob).size;
            uploads.push({ bucket, path, contentType: options?.contentType, upsert: options?.upsert, size });
            if (storage.failUpload?.(path)) return { data: null, error: { message: "upload refused" } };
            return { data: { path }, error: null };
          },
          async remove(paths: string[]) {
            removed.push(paths);
            return { data: [], error: null };
          },
        };
      },
    },
  };

  return { client: client as unknown as SupabaseClient, queries, uploads, removed };
}

/** Splits a PostgREST select string into `{ table: columns[] }`, following embeds like `alias:table!hint!inner(a, b)`. */
export function selectedColumns(select: string, root: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (table: string, column: string) => (out[table] ??= []).push(column);
  let i = 0;
  const parse = (table: string) => {
    let token = "";
    const flush = () => {
      const t = token.trim();
      if (t) add(table, t);
      token = "";
    };
    while (i < select.length) {
      const ch = select[i++];
      if (ch === ",") flush();
      else if (ch === ")") {
        flush();
        return;
      } else if (ch === "(") {
        // token is the embed head: [alias:]table[!hint][!inner]
        const head = token.trim();
        token = "";
        const name = head.includes(":") ? head.split(":")[1] : head;
        parse(name.split("!")[0]);
      } else token += ch;
    }
    flush();
  };
  parse(root);
  return out;
}
