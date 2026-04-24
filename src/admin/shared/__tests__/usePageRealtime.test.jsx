import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const mockChannel = vi.fn(() => mockChannel);
mockChannel.on = vi.fn(() => mockChannel);
mockChannel.subscribe = vi.fn();

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    channel: (...args) => mockChannel(...args),
    removeChannel: vi.fn(),
  },
}));

import { usePageRealtime } from "../usePageRealtime";

describe("usePageRealtime", () => {
  qaTest("coverage.use-page-realtime.skips-without-org", () => {
    renderHook(() =>
      usePageRealtime({
        organizationId: null,
        channelName: "test-channel",
        subscriptions: [{ table: "jurors", onPayload: vi.fn() }],
      })
    );
    expect(mockChannel).not.toHaveBeenCalled();
  });
});
