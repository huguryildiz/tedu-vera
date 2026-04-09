import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from "@/shared/lib/supabaseClient";
import { listAdminSessions, touchAdminSession } from "@/shared/api/admin/sessions";

describe("admin sessions api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps touchAdminSession payload and returns function response", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, session: { id: "s1" } },
      error: null,
    });

    const result = await touchAdminSession({
      deviceId: "dev_123",
      userAgent: "UA",
      browser: "Chrome",
      os: "macOS",
      authMethod: "Google",
      signedInAt: "2026-04-10T12:00:00.000Z",
      expiresAt: 1_800_000_000,
    });

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    const [fnName, options] = supabase.functions.invoke.mock.calls[0];
    expect(fnName).toBe("admin-session-touch");
    expect(options.body).toMatchObject({
      deviceId: "dev_123",
      userAgent: "UA",
      browser: "Chrome",
      os: "macOS",
      authMethod: "Google",
      signedInAt: "2026-04-10T12:00:00.000Z",
    });
    expect(typeof options.body.expiresAt).toBe("string");
    expect(result).toEqual({ ok: true, session: { id: "s1" } });
  });

  it("passes explicit bearer token header when provided", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, session: { id: "s2" } },
      error: null,
    });

    await touchAdminSession({
      deviceId: "dev_abc",
      userAgent: "UA",
      browser: "Chrome",
      os: "macOS",
      authMethod: "Email",
      accessToken: "token-123",
    });

    const [, options] = supabase.functions.invoke.mock.calls[0];
    expect(options.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("queries admin sessions ordered by last_activity_at descending", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    const select = vi.fn(() => ({ order }));
    supabase.from.mockReturnValue({ select });

    const rows = await listAdminSessions();

    expect(supabase.from).toHaveBeenCalledWith("admin_user_sessions");
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("last_activity_at", { ascending: false });
    expect(rows).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
