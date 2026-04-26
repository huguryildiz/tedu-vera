import { describe, vi, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

// ── Stable mock constants ─────────────────────────────────────────────────────

const { SIGN_IN } = vi.hoisted(() => ({
  SIGN_IN: vi.fn(() => new Promise(() => {})),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/auth", () => ({
  useAuth: () => ({ signIn: SIGN_IN }),
}));

vi.mock("../api/core/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], count: 0, error: null })),
    })),
  },
}));

import DemoAdminLoader from "../DemoAdminLoader";

beforeEach(() => {
  SIGN_IN.mockReset();
  SIGN_IN.mockImplementation(() => new Promise(() => {}));
});

describe("DemoAdminLoader", () => {
  qaTest("coverage.demo-loader.shows-loading-steps-on-mount", () => {
    render(<DemoAdminLoader onComplete={vi.fn()} />);
    expect(screen.getByText("Preparing your workspace")).toBeInTheDocument();
    expect(screen.getByText("Authenticating")).toBeInTheDocument();
    expect(screen.getByText("Loading organizations")).toBeInTheDocument();
    expect(screen.getByText("Syncing evaluation data")).toBeInTheDocument();
  });

  qaTest("coverage.demo-loader.auth-failure", async () => {
    SIGN_IN.mockImplementation(() => Promise.reject(new Error("auth failed")));
    render(<DemoAdminLoader onComplete={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Try again")).toBeInTheDocument()
    );
  });
});
