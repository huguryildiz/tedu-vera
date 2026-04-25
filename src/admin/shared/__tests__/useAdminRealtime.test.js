import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const mockChannel = {
  on: vi.fn(),
  subscribe: vi.fn(),
};

const mockRemoveChannel = vi.fn();
const mockSupabaseChannel = vi.fn(() => mockChannel);

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    get channel() { return mockSupabaseChannel; },
    get removeChannel() { return mockRemoveChannel; },
  },
}));

import { useAdminRealtime } from "../useAdminRealtime";

describe("useAdminRealtime", () => {
  beforeEach(() => {
    mockChannel.on.mockReturnValue(mockChannel);
    mockChannel.subscribe.mockReturnValue(mockChannel);
    mockSupabaseChannel.mockReturnValue(mockChannel);
    mockRemoveChannel.mockReset();
    mockSupabaseChannel.mockClear();
  });

  qaTest("admin.shared.realtime.01", () => {
    const onRefreshRef = { current: vi.fn() };
    renderHook(() =>
      useAdminRealtime({ organizationId: "org-1", onRefreshRef, enabled: false })
    );
    expect(mockSupabaseChannel).not.toHaveBeenCalled();
  });

  qaTest("admin.shared.realtime.02", () => {
    const onRefreshRef = { current: vi.fn() };
    renderHook(() =>
      useAdminRealtime({ organizationId: "", onRefreshRef, enabled: true })
    );
    expect(mockSupabaseChannel).not.toHaveBeenCalled();
  });

  qaTest("admin.shared.realtime.03", () => {
    const onRefreshRef = { current: vi.fn() };
    const { unmount } = renderHook(() =>
      useAdminRealtime({ organizationId: "org-1", onRefreshRef, enabled: true })
    );
    expect(mockSupabaseChannel).toHaveBeenCalledWith("admin-panel-live");
    expect(mockChannel.subscribe).toHaveBeenCalled();
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });

  qaTest("admin.shared.realtime.04", async () => {
    vi.useFakeTimers();
    const onRefreshFn = vi.fn();
    const onRefreshRef = { current: onRefreshFn };

    let capturedCallback = null;
    mockChannel.on.mockImplementation((_type, _filter, cb) => {
      capturedCallback = cb;
      return mockChannel;
    });

    renderHook(() =>
      useAdminRealtime({ organizationId: "org-1", onRefreshRef, enabled: true })
    );

    expect(capturedCallback).not.toBeNull();
    capturedCallback();
    expect(onRefreshFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600);
    expect(onRefreshFn).toHaveBeenCalledWith(expect.any(Array));

    vi.useRealTimers();
  });

  qaTest("admin.realtime.useAdminRealtime.01", () => {
    mockChannel.on.mockClear();
    mockChannel.subscribe.mockClear();
    mockSupabaseChannel.mockClear();

    const onRefreshRef = { current: vi.fn() };
    renderHook(() =>
      useAdminRealtime({ organizationId: "org-1", onRefreshRef, enabled: true })
    );
    expect(mockSupabaseChannel).toHaveBeenCalledWith("admin-panel-live");
    expect(mockChannel.on).toHaveBeenCalledTimes(4);
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  qaTest("admin.realtime.useAdminRealtime.02", () => {
    const onRefreshRef = { current: vi.fn() };
    const { unmount } = renderHook(() =>
      useAdminRealtime({ organizationId: "org-1", onRefreshRef, enabled: true })
    );
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });

  qaTest("admin.realtime.useAdminRealtime.03", () => {
    const onRefreshRef = { current: vi.fn() };
    const { rerender } = renderHook(
      ({ orgId }) => useAdminRealtime({ organizationId: orgId, onRefreshRef, enabled: true }),
      { initialProps: { orgId: "org-1" } }
    );
    vi.clearAllMocks();
    mockSupabaseChannel.mockReturnValue(mockChannel);
    rerender({ orgId: "org-2" });
    expect(mockRemoveChannel).toHaveBeenCalled();
    expect(mockSupabaseChannel).toHaveBeenCalledWith("admin-panel-live");
  });
});
