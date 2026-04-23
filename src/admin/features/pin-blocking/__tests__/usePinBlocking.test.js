import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/api", () => ({
  listLockedJurors: vi.fn().mockResolvedValue({ data: [], error: null }),
  countTodayLockEvents: vi.fn().mockResolvedValue({ data: 0, error: null }),
  unlockJurorPin: vi.fn().mockResolvedValue({ error: null }),
  listJurorsSummary: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { usePinBlocking } from "../usePinBlocking";

describe("usePinBlocking", () => {
  qaTest("admin.pin.hook.load", () => {
    const { result } = renderHook(() =>
      usePinBlocking({ periodId: "period-001" })
    );
    expect(Array.isArray(result.current.lockedJurors)).toBe(true);
    expect(typeof result.current.todayLockEvents).toBe("number");
    expect(typeof result.current.handleUnlock).toBe("function");
    expect(result.current.unlockModal).toBeNull();
  });
});
