import type { APIRequestContext } from "@playwright/test";

export interface ProbeResult {
  status: number;
  rows: unknown[];
}

export interface ProbeOptions {
  request: APIRequestContext;
  supabaseUrl: string;
  anonKey: string;
  tableName: string;
  filterColumn: string;
  filterValue: string;
  authJwt: string;
  /** Column to select. Defaults to "id". Use when the table has no id PK (e.g. juror_period_auth). */
  selectColumn?: string;
}

/**
 * Probes a Supabase REST endpoint with a tenant JWT, filtering by a foreign org/period ID.
 *
 * Expected outcomes when RLS is correct:
 *   - status 200 + rows.length === 0  (RLS silently filters)
 *   - status 403 / 401               (policy rejects outright)
 *
 * A non-empty 200 response indicates a potential cross-tenant data leak.
 */
export async function probeForeignOrgAccess(opts: ProbeOptions): Promise<ProbeResult> {
  const col = opts.selectColumn ?? "id";
  const url = `${opts.supabaseUrl}/rest/v1/${opts.tableName}?${opts.filterColumn}=eq.${opts.filterValue}&select=${col}`;
  const res = await opts.request.get(url, {
    headers: {
      apikey: opts.anonKey,
      Authorization: `Bearer ${opts.authJwt}`,
    },
  });
  const status = res.status();
  let rows: unknown[] = [];
  if (status === 200) {
    try {
      const body = await res.json();
      rows = Array.isArray(body) ? body : [];
    } catch {
      rows = [];
    }
  }
  return { status, rows };
}
