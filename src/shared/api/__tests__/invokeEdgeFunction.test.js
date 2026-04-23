import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../../test/qaTest.js";

const { mockGetSession, mockRefreshSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  mockRefreshSession: vi.fn().mockResolvedValue({ data: { session: null } }),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    supabaseUrl: "https://test.supabase.co",
    supabaseKey: "test-anon-key",
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  },
}));

import { invokeEdgeFunction } from "../core/invokeEdgeFunction.js";

describe("invokeEdgeFunction", () => {
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  qaTest("api.invokeEdgeFunction.01", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true, result: "done" }),
    });
    const { data, error } = await invokeEdgeFunction("test-fn", { body: { x: 1 } });
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true, result: "done" });
  });

  qaTest("api.invokeEdgeFunction.02", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Internal Server Error"),
    });
    const { data, error } = await invokeEdgeFunction("test-fn", { body: {} });
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Internal Server Error");
  });

  qaTest("api.invokeEdgeFunction.03", async () => {
    const freshSession = { access_token: "new-token", expires_at: Date.now() / 1000 + 3600 };
    mockRefreshSession.mockResolvedValue({ data: { session: freshSession } });

    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          text: vi.fn().mockResolvedValue("Unauthorized"),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ ok: true }),
      });
    });

    const { data, error } = await invokeEdgeFunction("secure-fn", { body: {} });
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
