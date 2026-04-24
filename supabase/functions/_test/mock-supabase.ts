// Mock Supabase JS client for Deno edge function tests.
// Mapped to `https://esm.sh/@supabase/supabase-js@2` via import_map.json.
//
// Tests configure behavior via `setMockConfig(...)`; the mocked `createClient`
// returns a chainable builder + auth/rpc stubs that read from the current
// config object. `resetMockConfig()` between tests keeps state clean.

export interface MockResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

export interface TableMock {
  selectMaybeSingle?: MockResult;
  selectSingle?: MockResult;
  // Result for a list-style select: `await client.from('t').select().eq(...)`
  // resolves to { data: [], error: null } via the builder's thenable path.
  selectList?: MockResult;
  upsert?: MockResult;
  insert?: MockResult;
  update?: MockResult;
  delete?: MockResult;
}

export interface MockConfig {
  authGetUser?: MockResult<{ user: { id: string } | null }>;
  adminGenerateLink?: MockResult<{
    properties?: { action_link?: string };
    user?: { id?: string };
  }>;
  // Map of user_id → getUserById response; unmatched ids return {user:null}.
  adminGetUserById?: Record<string, MockResult<{ user: { id: string; email?: string } | null }>>;
  adminListUsers?: MockResult<{ users: Array<{ id: string; email?: string }> }>;
  rpc?: Record<string, MockResult>;
  tables?: Record<string, TableMock>;
  storageUpload?: { data: { path: string } | null; error: { message: string } | null };
  storageRemove?: { data: unknown; error: { message: string } | null };
}

export interface CallRecord {
  clientKind: "anon" | "service";
  type: "auth.getUser" | "auth.admin.generateLink" | "rpc" | "from";
  name?: string;
  table?: string;
  op?: string;
  payload?: unknown;
}

let config: MockConfig = {};
let calls: CallRecord[] = [];

export function setMockConfig(c: MockConfig) {
  config = c;
}

export function resetMockConfig() {
  config = {};
  calls = [];
}

export function getCalls(): CallRecord[] {
  return [...calls];
}

function classifyClient(apiKey: string): "anon" | "service" {
  if (apiKey && apiKey.includes("service")) return "service";
  return "anon";
}

class QueryBuilder {
  private table: string;
  private clientKind: "anon" | "service";
  private lastOp: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: unknown = null;

  constructor(table: string, clientKind: "anon" | "service") {
    this.table = table;
    this.clientKind = clientKind;
    calls.push({ clientKind, type: "from", table });
  }

  private tableMock(): TableMock {
    return config.tables?.[this.table] ?? {};
  }

  select(_cols?: string) {
    return this;
  }

  insert(rows: unknown) {
    this.lastOp = "insert";
    this.payload = rows;
    calls.push({ clientKind: this.clientKind, type: "from", table: this.table, op: "insert", payload: rows });
    return this;
  }

  upsert(rows: unknown, _opts?: unknown) {
    this.lastOp = "upsert";
    this.payload = rows;
    calls.push({ clientKind: this.clientKind, type: "from", table: this.table, op: "upsert", payload: rows });
    return this;
  }

  update(rows: unknown) {
    this.lastOp = "update";
    this.payload = rows;
    calls.push({ clientKind: this.clientKind, type: "from", table: this.table, op: "update", payload: rows });
    return this;
  }

  delete() {
    this.lastOp = "delete";
    calls.push({ clientKind: this.clientKind, type: "from", table: this.table, op: "delete" });
    return this;
  }

  eq(_col: string, _val: unknown) {
    return this;
  }
  is(_col: string, _val: unknown) {
    return this;
  }
  in(_col: string, _vals: unknown) {
    return this;
  }
  lt(_col: string, _val: unknown) {
    return this;
  }
  lte(_col: string, _val: unknown) {
    return this;
  }
  gt(_col: string, _val: unknown) {
    return this;
  }
  gte(_col: string, _val: unknown) {
    return this;
  }
  neq(_col: string, _val: unknown) {
    return this;
  }
  like(_col: string, _val: unknown) {
    return this;
  }
  ilike(_col: string, _val: unknown) {
    return this;
  }
  not(_col: string, _op: string, _val: unknown) {
    return this;
  }
  or(_filters: string) {
    return this;
  }
  order(_col: string, _opts?: unknown) {
    return this;
  }
  limit(_n: number) {
    return this;
  }
  range(_from: number, _to: number) {
    return this;
  }

  async maybeSingle(): Promise<MockResult> {
    return this.tableMock().selectMaybeSingle ?? { data: null, error: null };
  }

  async single(): Promise<MockResult> {
    const t = this.tableMock();
    if (this.lastOp === "upsert") return t.upsert ?? { data: null, error: null };
    if (this.lastOp === "insert") return t.insert ?? { data: null, error: null };
    return t.selectSingle ?? { data: null, error: null };
  }

  // Thenable: `await builder` resolves with the per-op result.
  then<TResult1 = MockResult, TResult2 = never>(
    onFulfilled?: ((value: MockResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const t = this.tableMock();
    let result: MockResult;
    switch (this.lastOp) {
      case "insert":
        result = t.insert ?? { data: null, error: null };
        break;
      case "update":
        result = t.update ?? { data: null, error: null };
        break;
      case "delete":
        result = t.delete ?? { data: null, error: null };
        break;
      case "upsert":
        result = t.upsert ?? { data: null, error: null };
        break;
      default:
        // Prefer selectList when provided (awaiting the builder directly
        // without `.single()` is the list/array path); fall back to
        // selectSingle for back-compat, then empty.
        result = t.selectList ?? t.selectSingle ?? { data: [], error: null };
    }
    return Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined);
  }
}

export function createClient(_url: string, apiKey: string, _opts?: unknown) {
  const clientKind = classifyClient(apiKey);

  return {
    auth: {
      getUser: async (_token?: string) => {
        calls.push({ clientKind, type: "auth.getUser" });
        return config.authGetUser ?? { data: { user: null }, error: { message: "auth.getUser not mocked" } };
      },
      admin: {
        generateLink: async (opts: unknown) => {
          calls.push({ clientKind, type: "auth.admin.generateLink", payload: opts });
          return config.adminGenerateLink ?? { data: null, error: { message: "generateLink not mocked" } };
        },
        getUserById: async (userId: string) => {
          calls.push({ clientKind, type: "auth.getUser", name: userId });
          return (
            config.adminGetUserById?.[userId] ?? {
              data: { user: null },
              error: { message: `getUserById ${userId} not mocked` },
            }
          );
        },
        listUsers: async (_opts?: unknown) => {
          calls.push({ clientKind, type: "auth.getUser", name: "listUsers" });
          return config.adminListUsers ?? { data: { users: [] }, error: null };
        },
      },
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async (_path: string, _data: unknown, _opts?: unknown) => {
          return config.storageUpload ?? { data: { path: _path }, error: null };
        },
        remove: async (_paths: string[]) => {
          return config.storageRemove ?? { data: null, error: null };
        },
      }),
    },
    rpc: async (name: string, args?: unknown) => {
      calls.push({ clientKind, type: "rpc", name, payload: args });
      return config.rpc?.[name] ?? { data: null, error: { message: `rpc ${name} not mocked` } };
    },
    from: (table: string) => new QueryBuilder(table, clientKind),
  };
}

// Supabase SDK exports `SupabaseClient` as a type; re-export a structural alias
// so audit-log.ts can `import { createClient, SupabaseClient }`.
export type SupabaseClient = ReturnType<typeof createClient>;
