import { describe, expect, beforeAll, afterAll } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import { useIsMobile } from "../use-mobile.js";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe("hooks/useIsMobile", () => {
  qaTest("hooks.useIsMobile.01", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe("boolean");
  });
});
