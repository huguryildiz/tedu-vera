import { describe, expect, afterEach } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import { resolveEnvironment, isDemoEnvironment } from "../environment.js";

// jsdom's window.location is non-configurable — cannot use Object.defineProperty
// or vi.stubGlobal. Use history.pushState to change pathname in-place.
function setPathname(pathname) {
  window.history.pushState({}, "", pathname);
}

describe("environment", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  qaTest("lib.env.01", () => {
    setPathname("/admin/overview");
    expect(resolveEnvironment()).toBe("prod");
  });

  qaTest("lib.env.02", () => {
    setPathname("/demo/admin/overview");
    expect(resolveEnvironment()).toBe("demo");
  });

  qaTest("lib.env.03", () => {
    // jsdom always has window defined; SSR path (typeof window === "undefined")
    // is exercised by the source logic. Non-demo path must return prod.
    setPathname("/");
    expect(resolveEnvironment()).toBe("prod");
  });

  qaTest("lib.env.04", () => {
    setPathname("/admin");
    expect(isDemoEnvironment()).toBe(false);

    setPathname("/demo");
    expect(isDemoEnvironment()).toBe(true);
  });

  qaTest("lib.env.05", () => {
    // /demo-settings is NOT in the /demo/* namespace — must resolve as prod
    setPathname("/demo-settings");
    expect(resolveEnvironment()).toBe("prod");
  });
});
