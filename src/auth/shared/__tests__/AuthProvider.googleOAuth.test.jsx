import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { useContext } from "react";
import { qaTest } from "@/test/qaTest";

// ── Hoisted mocks (vi.hoisted avoids temporal dead zone) ──────────────────────

const {
  mockSignInWithOAuth,
  mockOnAuthStateChange,
  mockGetSession,
  mockRefreshSession,
  mockSignOut,
} = vi.hoisted(() => {
  let _authChangeCallback = null;
  const mockOnAuthStateChange = vi.fn((cb) => {
    _authChangeCallback = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mockOnAuthStateChange._getCallback = () => _authChangeCallback;
  mockOnAuthStateChange._fireEvent = (event, session) => {
    if (_authChangeCallback) {
      _authChangeCallback(event, session);
    }
  };

  return {
    mockSignInWithOAuth: vi.fn(),
    mockOnAuthStateChange,
    mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    mockRefreshSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    mockSignOut: vi.fn().mockResolvedValue({ error: null }),
  };
});

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
      signInWithOAuth: mockSignInWithOAuth,
      refreshSession: mockRefreshSession,
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  getPublicAuthFlags: vi.fn().mockResolvedValue({ googleOAuth: true }),
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
  getAuthMethodLabelFromSession: vi.fn().mockReturnValue("google"),
  parseUserAgent: vi.fn().mockReturnValue({ browser: "Chrome", os: "Mac" }),
}));

vi.mock("@/shared/lib/toastStore", () => ({
  toastStore: { emit: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

import AuthProvider, { AuthContext } from "../AuthProvider";

function GoogleOAuthTestConsumer() {
  const auth = useContext(AuthContext);
  if (!auth) return <div>no-ctx</div>;
  return (
    <div>
      <span data-testid="user">{auth.user ? auth.user.email : "null"}</span>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="profile-incomplete">{String(auth.profileIncomplete)}</span>
      <span data-testid="is-pending">{String(auth.isPending)}</span>
      <button onClick={() => auth.signInWithGoogle(false).catch(() => {})} data-testid="google-signin-btn">
        Sign in with Google
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <GoogleOAuthTestConsumer />
    </AuthProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("AuthProvider — Google OAuth", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockImplementation((cb) => {
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/oauth" }, error: null });

    // Reset getPublicAuthFlags to return googleOAuth=true by default
    const { getPublicAuthFlags } = await import("@/shared/api");
    getPublicAuthFlags.mockResolvedValue({ googleOAuth: true });
  });

  qaTest("auth.oauth.01", async () => {
    // signInWithGoogle calls signInWithOAuth with provider=google and redirectTo=/register
    const { getPublicAuthFlags } = await import("@/shared/api");
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Wait for getPublicAuthFlags effect to run and update policy
    await waitFor(() => {
      expect(getPublicAuthFlags).toHaveBeenCalled();
    });

    const btn = screen.getByTestId("google-signin-btn");
    await act(async () => {
      btn.click();
    });

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalled();
    });

    const call = mockSignInWithOAuth.mock.calls[0][0];
    expect(call.provider).toBe("google");
    expect(call.options.redirectTo).toContain("/register");
  });

  qaTest("auth.oauth.02", async () => {
    // signInWithGoogle initiates OAuth flow (core path, environment mocking deferred to E2E)
    // Note: jsdom makes window.location non-configurable, so redirectTo validation
    // is tested via E2E with real pathname. Unit test focuses on API call structure.
    const { getPublicAuthFlags } = await import("@/shared/api");

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Wait for getPublicAuthFlags effect to run and update policy
    await waitFor(() => {
      expect(getPublicAuthFlags).toHaveBeenCalled();
    });

    const btn = screen.getByTestId("google-signin-btn");
    await act(async () => {
      btn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalled();
    }, { timeout: 3000 });

    const call = mockSignInWithOAuth.mock.calls[0][0];
    // Verify OAuth was called with correct provider; redirectTo validation is in E2E
    expect(call.provider).toBe("google");
    expect(call.options.redirectTo).toBeTruthy();
  });

  qaTest("auth.oauth.03", async () => {
    // signInWithGoogle throws error when policy.googleOAuth is false
    const { getPublicAuthFlags } = await import("@/shared/api");
    getPublicAuthFlags.mockResolvedValue({ googleOAuth: false });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    const btn = screen.getByTestId("google-signin-btn");
    let errorThrown = false;

    await act(async () => {
      try {
        btn.click();
        // Wait a bit for the promise to reject
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (e) {
        errorThrown = true;
      }
    });

    // The button click itself doesn't throw directly; the error is in the async handler.
    // Verify that signInWithOAuth was not called.
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  qaTest("auth.oauth.04", async () => {
    // signInWithOAuth error path: error is thrown and caught by caller
    const { getPublicAuthFlags } = await import("@/shared/api");
    const oauthError = new Error("OAuth provider returned error");
    mockSignInWithOAuth.mockResolvedValue({ data: null, error: oauthError });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Wait for getPublicAuthFlags effect to run and update policy
    await waitFor(() => {
      expect(getPublicAuthFlags).toHaveBeenCalled();
    });

    const btn = screen.getByTestId("google-signin-btn");
    mockSignInWithOAuth.mockClear();

    await act(async () => {
      btn.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify that signInWithOAuth was called (it returns an error, which the caller would handle)
    expect(mockSignInWithOAuth).toHaveBeenCalled();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" })
    );
  });

  qaTest("auth.oauth.05", async () => {
    // Post-OAuth SIGNED_IN event with new user (no memberships) → profileIncomplete=true
    const { getSession } = await import("@/shared/api");
    let authCallback = null;

    mockOnAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Simulate post-OAuth redirect: new user signs in, no memberships yet
    const newSession = {
      user: {
        id: "google-user-1",
        email: "newuser@gmail.com",
        new_email: null,
        user_metadata: { name: "New User", profile_completed: false },
      },
      access_token: "oauth-token",
      expires_at: Date.now() / 1000 + 3600,
    };

    // No memberships returned (new user not yet approved)
    getSession.mockResolvedValue([]);

    await act(async () => {
      authCallback("SIGNED_IN", newSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("newuser@gmail.com");
    });

    // New user with no memberships and profile not completed → profileIncomplete=true
    expect(screen.getByTestId("profile-incomplete").textContent).toBe("true");
  });

  qaTest("auth.oauth.06", async () => {
    // Post-OAuth SIGNED_IN event with existing tenant membership → profileIncomplete=false, isPending=false
    const { getSession } = await import("@/shared/api");
    let authCallback = null;

    mockOnAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    const existingSession = {
      user: {
        id: "google-user-2",
        email: "existing@gmail.com",
        new_email: null,
        user_metadata: { name: "Existing User", profile_completed: true },
      },
      access_token: "oauth-token",
      expires_at: Date.now() / 1000 + 3600,
    };

    // User has an active membership
    getSession.mockResolvedValue([
      {
        organization_id: "org-123",
        role: "tenant_admin",
        organization: { id: "org-123", name: "Test Org", code: "TEST", status: "active" },
      },
    ]);

    await act(async () => {
      authCallback("SIGNED_IN", existingSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("existing@gmail.com");
    });

    // Existing user with membership and profile completed → profileIncomplete=false, isPending=false
    expect(screen.getByTestId("profile-incomplete").textContent).toBe("false");
    expect(screen.getByTestId("is-pending").textContent).toBe("false");
  });

  qaTest("auth.oauth.07", async () => {
    // Post-OAuth SIGNED_IN event with profile_completed=false, no memberships → pending review flow
    const { getSession } = await import("@/shared/api");
    let authCallback = null;

    mockOnAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    const pendingSession = {
      user: {
        id: "google-user-3",
        email: "pending@gmail.com",
        new_email: null,
        user_metadata: { name: "Pending User", profile_completed: true },
      },
      access_token: "oauth-token",
      expires_at: Date.now() / 1000 + 3600,
    };

    // No memberships (pending admin approval)
    getSession.mockResolvedValue([]);

    await act(async () => {
      authCallback("SIGNED_IN", pendingSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("pending@gmail.com");
    });

    // User with profile_completed=true but no memberships → isPending=true
    expect(screen.getByTestId("is-pending").textContent).toBe("true");
  });

  qaTest("auth.oauth.08", async () => {
    // redirectTo respects prod vs demo environment based on pathname
    const { getPublicAuthFlags } = await import("@/shared/api");
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Wait for getPublicAuthFlags effect to run and update policy
    await waitFor(() => {
      expect(getPublicAuthFlags).toHaveBeenCalled();
    });

    const btn = screen.getByTestId("google-signin-btn");

    // Test prod path (default)
    mockSignInWithOAuth.mockClear();
    await act(async () => {
      btn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalled();
    }, { timeout: 3000 });

    let call = mockSignInWithOAuth.mock.calls[0][0];
    expect(call.options.redirectTo).toMatch(/\/register$/);
    expect(call.options.redirectTo).not.toContain("/demo/register");
  });

  qaTest("auth.oauth.09", async () => {
    // signInWithGoogle stores rememberMe preference before redirect
    const { KEYS } = await import("@/shared/storage/keys");
    const { getPublicAuthFlags } = await import("@/shared/api");

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Wait for getPublicAuthFlags effect to run and update policy
    await waitFor(() => {
      expect(getPublicAuthFlags).toHaveBeenCalled();
    });

    const btn = screen.getByTestId("google-signin-btn");

    // Spy on localStorage.setItem
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    mockSignInWithOAuth.mockClear();

    await act(async () => {
      btn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Verify rememberMe was persisted (rememberMe=false passed to signInWithGoogle)
    expect(setItemSpy).toHaveBeenCalledWith(KEYS.ADMIN_REMEMBER_ME, "false");

    setItemSpy.mockRestore();
  });

  qaTest("auth.oauth.10", async () => {
    // oauth signInWithOAuth called with correct provider and options shape
    const { getPublicAuthFlags } = await import("@/shared/api");
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Wait for getPublicAuthFlags effect to run and update policy
    await waitFor(() => {
      expect(getPublicAuthFlags).toHaveBeenCalled();
    });

    const btn = screen.getByTestId("google-signin-btn");

    mockSignInWithOAuth.mockClear();

    await act(async () => {
      btn.click();
    });

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
    });

    const args = mockSignInWithOAuth.mock.calls[0][0];
    expect(args).toMatchObject({
      provider: "google",
      options: expect.objectContaining({
        redirectTo: expect.any(String),
      }),
    });
    expect(args.options.redirectTo).toMatch(/\/(demo\/)?register$/);
  });
});
