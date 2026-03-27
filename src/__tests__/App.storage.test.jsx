// src/__tests__/App.storage.test.jsx
// ============================================================
// Phase A safety tests — locks the App.jsx page resume/storage flow.
//
// Covers:
//   phaseA.app.01 — URL ?t= token routes to jury_gate
//   phaseA.app.02 — localStorage page restoration ("admin")
//   phaseA.app.03 — jury_gate is never written to localStorage
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { qaTest } from "../test/qaTest.js";

// ── Heavy mocks (all before any import of App) ────────────────
vi.mock("../JuryForm", () => ({ default: () => <div data-testid="jury-form" /> }));
vi.mock("../AdminPanel", () => ({ default: () => <div data-testid="admin-panel" /> }));
vi.mock("../jury/JuryGatePage", () => ({ default: () => <div data-testid="jury-gate" /> }));
vi.mock("../shared/api", () => ({
  adminSecurityState: vi.fn().mockResolvedValue({ admin_password_set: true }),
  adminLogin: vi.fn().mockResolvedValue(false),
  adminBootstrapPassword: vi.fn(),
  submitAdminApplication: vi.fn(),
  listTenantsPublic: vi.fn().mockResolvedValue([]),
  getMyApplications: vi.fn().mockResolvedValue([]),
}));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));
vi.mock("../shared/scrollIndicators", () => ({ initScrollIndicators: () => () => {} }));
vi.mock("../shared/MinimalLoaderOverlay", () => ({ default: () => null }));
vi.mock("../components/auth/LoginForm", () => ({
  default: ({ onLogin, onSwitchToRegister }) => (
    <div data-testid="login-form">
      <button onClick={onSwitchToRegister}>Apply for access</button>
      <button onClick={() => onLogin("test@test.com", "pass")}>Sign In</button>
    </div>
  ),
}));
vi.mock("../components/auth/ForgotPasswordForm", () => ({ default: () => <div data-testid="forgot-form" /> }));
vi.mock("../components/auth/RegisterForm", () => ({ default: () => <div data-testid="register-form" /> }));
vi.mock("../admin/components/PendingReviewGate", () => ({ default: () => <div data-testid="pending-gate" /> }));
vi.mock("../shared/Icons", () => ({
  ClipboardIcon:  () => null,
  ShieldUserIcon: () => null,
  AlertCircleIcon: () => null,
  TriangleAlertLucideIcon: () => null,
  InfoIcon: () => null,
  CheckCircle2Icon: () => null,
  EyeIcon:        () => null,
  EyeOffIcon:     () => null,
}));

// Import App AFTER all mocks are declared
import App from "../App";

// ── Helpers ───────────────────────────────────────────────────

/**
 * Override window.location.search and window.location.pathname for the
 * duration of a test, then restore afterwards.
 */
function mockLocation({ search = "", pathname = "/" } = {}) {
  const originalLocation = window.location;
  delete window.location;
  window.location = {
    ...originalLocation,
    search,
    pathname,
  };
  return () => {
    window.location = originalLocation;
  };
}

// ── Test suite ────────────────────────────────────────────────

describe("App page resume / storage flow", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  qaTest("phaseA.app.01", () => {
    const restore = mockLocation({ search: "?t=abc123", pathname: "/" });
    try {
      render(<App />);
      expect(screen.getByTestId("jury-gate")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  qaTest("phaseA.app.02", async () => {
    localStorage.setItem("vera_portal_page", "admin");
    const restore = mockLocation({ search: "", pathname: "/" });
    try {
      render(<App />);
      // Wait for auth state to resolve (async getSession mock resolves with null).
      // When page === "admin" and not authenticated, App renders the login form.
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
      });
    } finally {
      restore();
    }
  });

  qaTest("phaseA.app.03", () => {
    const restore = mockLocation({ search: "?t=abc", pathname: "/" });
    try {
      render(<App />);
      // App is on jury_gate. The persistence useEffect must not write "jury_gate".
      const stored = localStorage.getItem("vera_portal_page");
      expect(stored).not.toBe("jury_gate");
    } finally {
      restore();
    }
  });

  it("does not route to email review page when URL has ?token", () => {
    const restore = mockLocation({ search: "?token=abc123", pathname: "/" });
    try {
      render(<App />);
      expect(screen.queryByTestId("jury-gate")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /admin panel/i })).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
