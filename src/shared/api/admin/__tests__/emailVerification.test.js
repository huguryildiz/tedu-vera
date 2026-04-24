import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

const mockInvoke = vi.fn();

vi.mock("../../core/invokeEdgeFunction", () => ({
  invokeEdgeFunction: (...args) => mockInvoke(...args),
}));

import { sendEmailVerification, confirmEmailVerification } from "../emailVerification";

describe("emailVerification", () => {
  qaTest("coverage.email-verification.send", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await sendEmailVerification();
    expect(result).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledWith("email-verification-send", { body: {} });
  });

  qaTest("coverage.email-verification.confirm", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await confirmEmailVerification("tok123");
    expect(result).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledWith("email-verification-confirm", { body: { token: "tok123" } });
  });
});
