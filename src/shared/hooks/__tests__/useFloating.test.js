import { describe, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { qaTest } from "../../../test/qaTest.js";
import { useFloating } from "../useFloating.js";

describe("hooks/useFloating", () => {
  qaTest("hooks.useFloating.01", () => {
    const triggerRef = { current: null };
    const { result } = renderHook(() =>
      useFloating({
        triggerRef,
        isOpen: false,
        onClose: () => {},
        placement: "bottom-start",
        offset: 4,
      })
    );
    expect(result.current.floatingStyle.position).toBe("fixed");
    expect(result.current.floatingRef).toBeDefined();
    expect(typeof result.current.updatePosition).toBe("function");
    expect(typeof result.current.actualPlacement).toBe("string");
  });
});
