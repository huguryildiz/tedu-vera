import { describe, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import { useAdminResponsiveTableMode } from "../useAdminResponsiveTableMode";

describe("useAdminResponsiveTableMode", () => {
  qaTest("coverage.use-admin-responsive-table-mode.default-view", () => {
    const { result } = renderHook(() => useAdminResponsiveTableMode());
    expect(result.current).toHaveProperty("shouldUseCardLayout");
    expect(result.current).toHaveProperty("shouldUseTableLayout");
    expect(typeof result.current.isPortrait).toBe("boolean");
  });
});
