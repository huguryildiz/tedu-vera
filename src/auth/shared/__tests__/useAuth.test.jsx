import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { createContext } from "react";
import { qaTest } from "@/test/qaTest";

// Create a standalone AuthContext so this test has no supabase transitive deps
const AuthContext = createContext(null);

vi.mock("../AuthProvider", () => {
  const { createContext } = require("react");
  // Export the same context instance used in this test module
  const AuthContext = createContext(null);
  return { AuthContext, default: () => null };
});

// Import useAuth AFTER the mock is established
import { useAuth } from "../useAuth";

const mockAuthValue = {
  user: { id: "u1", email: "test@example.com" },
  loading: false,
  signOut: () => {},
};

// Re-import AuthContext from the mocked module so it matches useAuth's reference
import { AuthContext as MockedAuthContext } from "../AuthProvider";

function AuthWrapper({ children }) {
  return (
    <MockedAuthContext.Provider value={mockAuthValue}>{children}</MockedAuthContext.Provider>
  );
}

describe("useAuth", () => {
  qaTest("auth.useAuth.01", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthWrapper });
    expect(result.current.user).toEqual(mockAuthValue.user);
    expect(result.current.loading).toBe(false);
    expect(typeof result.current.signOut).toBe("function");
  });

  qaTest("auth.useAuth.02", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within AuthProvider");
  });
});
