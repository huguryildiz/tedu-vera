import { describe, afterEach, vi, expect } from "vitest";
import { qaTest } from "../../../test/qaTest.js";

// DEMO_MODE is evaluated at module load time, so we must set the pathname via
// history.pushState BEFORE each dynamic import, then reset modules after.
describe("demoMode — DEMO_MODE", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
    vi.resetModules();
  });

  qaTest("lib.demo.01", async () => {
    window.history.pushState({}, "", "/admin/overview");
    const { DEMO_MODE } = await import("../demoMode.js");
    expect(DEMO_MODE).toBe(false);
  });

  qaTest("lib.demo.02", async () => {
    window.history.pushState({}, "", "/demo/admin");
    const { DEMO_MODE } = await import("../demoMode.js");
    expect(DEMO_MODE).toBe(true);
  });
});
