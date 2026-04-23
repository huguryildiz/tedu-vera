import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { useContext } from "react";
import { qaTest } from "@/test/qaTest";

// ── Hoisted mocks (vi.hoisted avoids temporal dead zone with vi.mock hoisting) ─

const {
  mockSignOut,
  mockSignInWithPassword,
  mockRefreshSession,
  mockGetUser,
  mockGetSession,
  mockOnAuthStateChange,
} = vi.hoisted(() => {
  let _authChangeCallback = null;
  const mockOnAuthStateChange = vi.fn((cb) => {
    _authChangeCallback = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mockOnAuthStateChange._getCallback = () => _authChangeCallback;

  return {
    mockSignOut: vi.fn().mockResolvedValue({ error: null }),
    mockSignInWithPassword: vi.fn(),
    mockRefreshSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    mockGetUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    mockOnAuthStateChange,
  };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
      signInWithPassword: mockSignInWithPassword,
      refreshSession: mockRefreshSession,
      getUser: mockGetUser,
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

// ── Helpers ────────────────────────────────────────────────────────────────────

import AuthProvider, { AuthContext } from "../AuthProvider";

function ContextConsumer() {
  const auth = useContext(AuthContext);
  if (!auth) return <div>no-ctx</div>;
  return (
    <div>
      <span data-testid="user">{auth.user ? auth.user.email : "null"}</span>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="is-super">{String(auth.isSuper)}</span>
      <button onClick={auth.signOut}>sign-out</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <ContextConsumer />
    </AuthProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockImplementation((cb) => {
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  qaTest("auth.provider.01", async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user")).toBeInTheDocument();
  });

  qaTest("auth.provider.02", async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  qaTest("auth.provider.03", async () => {
    const mockSession = {
      user: {
        id: "u1",
        email: "test@example.com",
        new_email: null,
        user_metadata: { name: "Test User", profile_completed: true },
      },
      access_token: "tok",
      expires_at: Date.now() / 1000 + 3600,
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
  });

  qaTest("auth.provider.04", async () => {
    const mockSession = {
      user: {
        id: "u1",
        email: "test@example.com",
        new_email: null,
        user_metadata: { name: "Test", profile_completed: true },
      },
      access_token: "tok",
      expires_at: Date.now() / 1000 + 3600,
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      fireEvent.click(screen.getByText("sign-out"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });

  qaTest("auth.provider.05", async () => {
    const { getSession, listOrganizationsPublic } = await import("@/shared/api");

    const mockSession = {
      user: {
        id: "su1",
        email: "super@example.com",
        new_email: null,
        user_metadata: { name: "Super", profile_completed: true },
      },
      access_token: "tok",
      expires_at: Date.now() / 1000 + 3600,
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    getSession.mockResolvedValue([{ organization_id: null, role: "super_admin", organization: null }]);
    listOrganizationsPublic.mockResolvedValue([
      { id: "org-1", code: "TEST", name: "Test Org", setup_completed_at: null },
    ]);

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("is-super").textContent).toBe("true");
  });
});
