import { describe, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import { useAnchoredPopover } from "../useAnchoredPopover.js";

describe("hooks/useAnchoredPopover", () => {
  qaTest("hooks.useAnchoredPopover.01", () => {
    const { result } = renderHook(() => useAnchoredPopover(false));
    expect(result.current.triggerRef).toBeDefined();
    expect(result.current.panelRef).toBeDefined();
    expect(typeof result.current.panelPlacement).toBe("string");
  });
});
