import { describe, expect, vi } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import { withRetry } from "../core/retry.js";

describe("withRetry", () => {
  qaTest("api.retry.01", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  qaTest("api.retry.02", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(() => {
      calls++;
      if (calls < 3) throw new TypeError("Failed to fetch");
      return Promise.resolve("recovered");
    });
    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 0 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  qaTest("api.retry.03", async () => {
    const abortError = new DOMException("The user aborted", "AbortError");
    const fn = vi.fn().mockRejectedValue(abortError);
    await expect(withRetry(fn, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow("The user aborted");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  qaTest("api.retry.04", async () => {
    const businessError = new Error("permission denied");
    const fn = vi.fn().mockRejectedValue(businessError);
    await expect(withRetry(fn, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow("permission denied");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
