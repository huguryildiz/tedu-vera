import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

import * as AuthBarrel from "../index.js";

describe("auth barrel", () => {
  qaTest("coverage.auth-barrel.exports", () => {
    expect(AuthBarrel.AuthProvider).toBeDefined();
    expect(AuthBarrel.useAuth).toBeDefined();
  });
});
