import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

import * as SharedApi from "../api.js";
import * as AdminApi from "../api/admin/index.js";

describe("shared/api barrel", () => {
  qaTest("coverage.shared-api-barrel.exports", () => {
    expect(SharedApi).toBeDefined();
    expect(Object.keys(SharedApi).length).toBeGreaterThan(0);
  });
});

describe("shared/api/admin barrel", () => {
  qaTest("coverage.admin-api-barrel.exports", () => {
    expect(AdminApi).toBeDefined();
    expect(Object.keys(AdminApi).length).toBeGreaterThan(0);
  });
});
