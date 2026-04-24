// src/auth/shared/__tests__/authRecovery.test.js
// Tests for getSessionWithRetry and isRecoverableAuthLockError (module-private in AuthProvider).
// Exercised through observable AuthProvider behavior: supabase.auth.getSession call count,
// refreshSession calls, and the loading state visible via AuthContext.

import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { useContext } from "react";
import { qaTest } from "@/test/qaTest";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const { mockGetSession, mockRefreshSession, mockOnAuthStateChange } = vi.hoisted(() => {
  const mockOnAuthStateChange = vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));
  return {
    mockGetSession: vi.fn(),
    mockRefreshSession: vi.fn(),
    mockOnAuthStateChange,
  };
});

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
  clearPersistedSession: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  getSession: vi.fn().mockResolvedValue([]),
  getMyJoinRequests: vi.fn().mockResolvedValue([]),
  listOrganizationsPublic: vi.fn().mockResolvedValue([]),
  getSecurityPolicy: vi.fn().mockResolvedValue(null),
  getPublicAuthFlags: vi.fn().mockResolvedValue(null),
  touchAdminSession: vi.fn().mockResolvedValue(null),
  writeAuthFailureEvent: vi.fn().mockResolvedValue(null),
  sendEmailVerification: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/shared/api/admin/profiles", () => ({
  upsertProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/shared/api/core/invokeEdgeFunction", () => ({
  invokeEdgeFunction: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock("@/shared/storage/adminStorage", () => ({
  getActiveOrganizationId: vi.fn().mockReturnValue(null),
  setActiveOrganizationId: vi.fn(),
}));

vi.mock("@/shared/lib/demoMode", () => ({ DEMO_MODE: false }));
vi.mock("@/shared/lib/adminSession", () => ({
  getAdminDeviceId: vi.fn().mockReturnValue("device-1"),
  getAuthMethodLabelFromSession: vi.fn().mockReturnValue("password"),
  parseUserAgent: vi.fn().mockReturnValue({ browser: "Chrome", os: "Mac" }),
}));
vi.mock("@/shared/lib/toastStore", () => ({
  toastStore: { emit: vi.fn() },
}));

import AuthProvider, { AuthContext } from "../AuthProvider";

// ─── helpers ─────────────────────────────────────────────────────────────────

function LoadingConsumer() {
  const auth = useContext(AuthContext);
  if (!auth) return <div data-testid="loading">true</div>;
  return <div data-testid="loading">{String(auth.loading)}</div>;
}

function renderProvider() {
  return render(
    <AuthProvider>
      <LoadingConsumer />
    </AuthProvider>
  );
}

function makeAbortError(message) {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}

const STEAL_MSG = "Lock broken by another request with the 'steal' option";
const NOT_RELEASED_MSG = "was not released within 5000ms";

// ─── tests ───────────────────────────────────────────────────────────────────

describe("AuthProvider — isRecoverableAuthLockError + getSessionWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  // ─── isRecoverableAuthLockError variants ──────────────────────────────────

  qaTest("auth.recovery.01", async () => {
    // AbortError with steal message → retry triggered
    mockGetSession
      .mockRejectedValueOnce(makeAbortError(STEAL_MSG))
      .mockResolvedValue({ data: { session: null } });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(mockGetSession).toHaveBeenCalledTimes(2);
  });

  qaTest("auth.recovery.02", async () => {
    // AbortError with 'not released within' message → retry triggered
    mockGetSession
      .mockRejectedValueOnce(makeAbortError(NOT_RELEASED_MSG))
      .mockResolvedValue({ data: { session: null } });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(mockGetSession).toHaveBeenCalledTimes(2);
  });

  qaTest("auth.recovery.03", async () => {
    // TypeError (non-AbortError) → NOT retried, getSession called exactly once
    mockGetSession.mockRejectedValueOnce(new TypeError("network"));
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  qaTest("auth.recovery.04", async () => {
    // AbortError with unrelated message → NOT retried
    mockGetSession.mockRejectedValueOnce(makeAbortError("user aborted"));
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  qaTest("auth.recovery.05", async () => {
    // null error → isRecoverableAuthLockError(null) returns false, no retry
    mockGetSession.mockRejectedValueOnce(null);
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  // ─── getSessionWithRetry retry behavior ───────────────────────────────────

  qaTest("auth.recovery.06", async () => {
    // First attempt success → getSession called exactly once
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  qaTest("auth.recovery.07", async () => {
    // First throws lock error, second succeeds → 2 total calls
    mockGetSession
      .mockRejectedValueOnce(makeAbortError(STEAL_MSG))
      .mockResolvedValue({ data: { session: null } });
    renderProvider();
    await waitFor(
      () => expect(screen.getByTestId("loading").textContent).toBe("false"),
      { timeout: 2000 }
    );
    expect(mockGetSession).toHaveBeenCalledTimes(2);
  });

  qaTest("auth.recovery.08", async () => {
    // 3 consecutive lock errors → throws after 3 attempts, getSession called 3 times
    mockGetSession.mockRejectedValue(makeAbortError(STEAL_MSG));
    renderProvider();
    await waitFor(
      () => expect(screen.getByTestId("loading").textContent).toBe("false"),
      { timeout: 3000 }
    );
    expect(mockGetSession).toHaveBeenCalledTimes(3);
  });

  qaTest("auth.recovery.09", async () => {
    // Non-recoverable error (TypeError) → throws immediately after 1 attempt
    mockGetSession.mockRejectedValueOnce(new TypeError("network failed"));
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  // ─── backoff timing ───────────────────────────────────────────────────────

  qaTest("auth.recovery.10", async () => {
    // Backoff: 120ms on first retry, 240ms on second — verified via fake timers
    vi.useFakeTimers();
    try {
      const err = makeAbortError(STEAL_MSG);
      mockGetSession
        .mockRejectedValueOnce(err) // i=0 → wait(120ms)
        .mockRejectedValueOnce(err) // i=1 → wait(240ms)
        .mockResolvedValue({ data: { session: null } }); // i=2 → success

      await act(async () => {
        renderProvider();
      });

      // After initial effects: first attempt ran, now waiting 120ms
      expect(mockGetSession).toHaveBeenCalledTimes(1);

      // Advance 120ms → first backoff resolves → second attempt fires
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120);
      });
      expect(mockGetSession).toHaveBeenCalledTimes(2);

      // Advance 240ms → second backoff resolves → third attempt fires and succeeds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(240);
      });
      expect(mockGetSession).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  // ─── near-expiry pre-refresh ──────────────────────────────────────────────

  qaTest("auth.recovery.11", async () => {
    // Session with expires_at within 30s → getSessionWithRetry calls refreshSession
    const nearExpiry = Math.floor(Date.now() / 1000) + 10;
    const mockSession = {
      access_token: "old-tok",
      expires_at: nearExpiry,
      user: { id: "u1", email: "a@b.com", user_metadata: {} },
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          ...mockSession,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          access_token: "new-tok",
        },
      },
    });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  // ─── loading=false after retry exhaustion ────────────────────────────────

  qaTest("auth.recovery.12", async () => {
    // After 3 lock errors (retry exhaustion), AuthProvider must reach loading=false
    // — user must not be stuck on a blank loading screen
    mockGetSession.mockRejectedValue(makeAbortError(STEAL_MSG));
    renderProvider();
    await waitFor(
      () => expect(screen.getByTestId("loading").textContent).toBe("false"),
      { timeout: 3000 }
    );
  });
});
