// Shared test harness for edge function Deno.serve handlers.
//
// Each edge function calls Deno.serve(handler) at module top-level. Tests
// capture the handler by replacing Deno.serve before importing the module,
// then invoke it directly with synthetic Request objects — no local
// Supabase runtime needed.

type DenoServeHandler = (req: Request) => Response | Promise<Response>;

interface CaptureResult {
  handler: DenoServeHandler;
}

let captureCounter = 0;

export async function captureHandler(modulePath: string): Promise<CaptureResult> {
  let captured: DenoServeHandler | null = null;
  // deno-lint-ignore no-explicit-any
  const originalServe = (Deno as any).serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (arg1: unknown, arg2?: unknown) => {
    // Supabase functions call Deno.serve(handler) or Deno.serve(opts, handler).
    captured = (typeof arg1 === "function" ? arg1 : arg2) as DenoServeHandler;
    return {
      finished: Promise.resolve(),
      shutdown: () => Promise.resolve(),
      ref: () => {},
      unref: () => {},
      addr: { transport: "tcp", hostname: "localhost", port: 0 } as Deno.NetAddr,
    };
  };
  try {
    // Cache-bust so each capture re-runs the module's top-level Deno.serve().
    // A monotonic counter avoids collisions when multiple imports happen in
    // the same millisecond.
    captureCounter += 1;
    await import(`${modulePath}?cb=${captureCounter}`);
  } finally {
    // deno-lint-ignore no-explicit-any
    (Deno as any).serve = originalServe;
  }
  if (!captured) {
    throw new Error(`Deno.serve was not called by ${modulePath}`);
  }
  return { handler: captured };
}

export function setDefaultEnv() {
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
}

export function clearSupabaseEnv() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_ANON_KEY");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
}

export function makeRequest(opts: {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(opts.headers ?? {}),
  };
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  return new Request("http://localhost/fn", {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Replace globalThis.fetch with a test-provided handler. Returns a
 * restore fn that must be called (typically via try/finally) to avoid
 * bleeding mocks into other tests.
 */
export function stubFetch(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): () => void {
  const original = globalThis.fetch;
  // deno-lint-ignore no-explicit-any
  globalThis.fetch = handler as any;
  return () => {
    globalThis.fetch = original;
  };
}
