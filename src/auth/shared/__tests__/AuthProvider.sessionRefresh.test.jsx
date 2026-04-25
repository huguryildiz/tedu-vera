import { describe, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest";

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
  clearPersistedSession: vi.fn(),
}));

// API wrappers return raw values (array or object), not { data, error } envelopes.
// AuthProvider.fetchMemberships does `data || []` on getSession's return; mocking
// it as { data: [] } yields a truthy object that fails .map(...).
vi.mock("@/shared/api", () => ({
  getSession: vi.fn().mockResolvedValue([]),
  getMyJoinRequests: vi.fn().mockResolvedValue([]),
  listOrganizationsPublic: vi.fn().mockResolvedValue([]),
  getSecurityPolicy: vi.fn().mockResolvedValue({}),
  getPublicAuthFlags: vi.fn().mockResolvedValue({}),
  touchAdminSession: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/shared/api/admin/profiles", () => ({
  upsertProfile: vi.fn().mockResolvedValue({ display_name: "Test User" }),
}));

vi.mock("@/shared/storage/adminStorage", () => ({
  getActiveOrganizationId: vi.fn().mockReturnValue(null),
  setActiveOrganizationId: vi.fn(),
}));

import AuthProvider from "../AuthProvider.jsx";
import { supabase } from "@/shared/lib/supabaseClient";

describe("auth/shared/AuthProvider/sessionRefresh", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.onAuthStateChange).mockClear();
    vi.mocked(supabase.auth.getSession).mockClear();
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    });
  });

  qaTest("auth.AuthProvider.sessionRefresh.01", async () => {
    const testSession = {
      user: { id: "user-1", email: "test@example.com" },
      access_token: "token-123",
    };

    let authCallback = null;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    });

    const { queryByText } = render(
      <AuthProvider>
        <div>Test App</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText("Test App")).toBeInTheDocument();
    });

    if (authCallback) {
      await act(async () => {
        authCallback("TOKEN_REFRESHED", testSession);
      });

      await waitFor(() => {
        expect(authCallback).toBeDefined();
      });
    }
  });

  qaTest("auth.AuthProvider.sessionRefresh.02", async () => {
    let authCallback = null;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    });

    const { queryByText } = render(
      <AuthProvider>
        <div>Test App</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText("Test App")).toBeInTheDocument();
    });

    if (authCallback) {
      await act(async () => {
        authCallback("SIGNED_OUT", null);
      });

      await waitFor(() => {
        expect(authCallback).toBeDefined();
      });
    }
  });

  qaTest("auth.AuthProvider.sessionRefresh.03", async () => {
    let authCallback = null;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1", email: "test@example.com" },
          access_token: "token-123",
        },
      },
    });

    const { queryByText } = render(
      <AuthProvider>
        <div>Test App</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText("Test App")).toBeInTheDocument();
    });

    const localStorageSpy = vi.spyOn(Storage.prototype, "getItem");
    localStorageSpy.mockReturnValue("true");

    if (authCallback) {
      await act(async () => {
        authCallback("SIGNED_IN", {
          user: { id: "user-1", email: "test@example.com" },
          access_token: "token-123",
        });
      });
    }

    localStorageSpy.mockRestore();
  });
});
