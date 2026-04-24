// src/shared/api/core/__tests__/invokeEdgeFunction.test.js
// Tests for invokeEdgeFunction: 401 refresh/retry, network propagation,
// JSON parse error, always-POST, session handling, header/body construction.

import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

const { mockGetSession, mockRefreshSession, mockFetch } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: mockGetSession, refreshSession: mockRefreshSession },
    supabaseUrl: "https://test.supabase.co",
    supabaseKey: "test-anon-key",
  },
}));

import { invokeEdgeFunction } from "../invokeEdgeFunction.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeSession(overrides = {}) {
  return {
    access_token: "tok-abc",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function mockRes(status, bodyOrText) {
  const isObj = typeof bodyOrText === "object" && bodyOrText !== null;
  const text = isObj ? JSON.stringify(bodyOrText) : String(bodyOrText ?? "");
  return {
    ok: status >= 200 && status < 300,
    status,
    json: isObj
      ? vi.fn().mockResolvedValue(bodyOrText)
      : vi.fn().mockRejectedValue(new SyntaxError("Not JSON")),
    text: vi.fn().mockResolvedValue(text),
  };
}

function mockResJsonFail(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
    text: vi.fn().mockResolvedValue("not-json"),
  };
}

describe("invokeEdgeFunction", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockGetSession.mockReset();
    mockRefreshSession.mockReset();
    mockFetch.mockReset();
    // Default: valid session, no expiry concern
    mockGetSession.mockResolvedValue({ data: { session: makeSession() } });
    mockRefreshSession.mockResolvedValue({ data: { session: makeSession({ access_token: "tok-refreshed" }) } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── success ──────────────────────────────────────────────────────────────

  qaTest("edge.kong.01", async () => {
    mockFetch.mockResolvedValue(mockRes(200, { ok: true }));
    const result = await invokeEdgeFunction("my-fn");
    expect(result).toEqual({ data: { ok: true }, error: null });
  });

  // ─── 401 refresh/retry ────────────────────────────────────────────────────

  qaTest("edge.kong.02", async () => {
    mockFetch
      .mockResolvedValueOnce(mockRes(401, "Unauthorized"))
      .mockResolvedValueOnce(mockRes(200, { ok: true }));
    const result = await invokeEdgeFunction("my-fn");
    expect(result).toEqual({ data: { ok: true }, error: null });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  qaTest("edge.kong.03", async () => {
    mockFetch.mockResolvedValue(mockRes(401, "Unauthorized"));
    const result = await invokeEdgeFunction("my-fn");
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toMatch(/session expired/i);
    // Must NOT throw — callers must not need try/catch for 401
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ─── network failure propagates ───────────────────────────────────────────

  qaTest("edge.kong.04", async () => {
    mockFetch.mockRejectedValue(new Error("Failed to fetch"));
    await expect(invokeEdgeFunction("my-fn")).rejects.toThrow("Failed to fetch");
  });

  // ─── JSON parse fail ──────────────────────────────────────────────────────

  qaTest("edge.kong.05", async () => {
    mockFetch.mockResolvedValue(mockResJsonFail(200));
    const result = await invokeEdgeFunction("my-fn");
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("Invalid JSON response from Edge Function");
  });

  // ─── no session → no Authorization header ─────────────────────────────────

  qaTest("edge.kong.06", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFetch.mockResolvedValue(mockRes(200, { ok: true }));
    await invokeEdgeFunction("my-fn");
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  // ─── expired session pre-refresh ─────────────────────────────────────────

  qaTest("edge.kong.07", async () => {
    // expires_at within 30s → should refresh BEFORE first fetch
    const soonExpiry = Math.floor(Date.now() / 1000) + 10;
    mockGetSession.mockResolvedValue({
      data: { session: makeSession({ expires_at: soonExpiry }) },
    });
    mockFetch.mockResolvedValue(mockRes(200, { ok: true }));
    await invokeEdgeFunction("my-fn");
    // refreshSession must have been called before the first (and only) fetch
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer tok-refreshed");
  });

  // ─── non-ok non-401 → error with response text ────────────────────────────

  qaTest("edge.kong.08", async () => {
    mockFetch.mockResolvedValue(mockRes(500, "Internal Server Error"));
    const result = await invokeEdgeFunction("my-fn");
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("Internal Server Error");
  });

  // ─── always POST ─────────────────────────────────────────────────────────

  qaTest("edge.kong.09", async () => {
    mockFetch.mockResolvedValue(mockRes(200, {}));
    await invokeEdgeFunction("my-fn");
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  // ─── URL construction ────────────────────────────────────────────────────

  qaTest("edge.kong.10", async () => {
    mockFetch.mockResolvedValue(mockRes(200, {}));
    await invokeEdgeFunction("my-function");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/functions/v1/my-function");
  });

  // ─── custom headers merged ───────────────────────────────────────────────

  qaTest("edge.kong.11", async () => {
    mockFetch.mockResolvedValue(mockRes(200, {}));
    await invokeEdgeFunction("my-fn", { headers: { "X-Custom-Header": "custom-value" } });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Custom-Header"]).toBe("custom-value");
    // Standard headers must still be present
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["apikey"]).toBe("test-anon-key");
  });

  // ─── body serialized as JSON ─────────────────────────────────────────────

  qaTest("edge.kong.12", async () => {
    mockFetch.mockResolvedValue(mockRes(200, {}));
    const payload = { key: "value", count: 42 };
    await invokeEdgeFunction("my-fn", { body: payload });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.body).toBe(JSON.stringify(payload));
  });
});
