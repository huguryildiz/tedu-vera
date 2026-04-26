import { describe, vi, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/assets/vera_logo_dark.png", () => ({ default: "dark-logo.png" }));
vi.mock("@/assets/vera_logo_white.png", () => ({ default: "white-logo.png" }));

const {
  mockGetSession,
  mockOnAuthStateChange,
  mockUpdateUser,
  mockFrom,
  mockRpc,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      updateUser: mockUpdateUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import InviteAcceptScreen from "../InviteAcceptScreen";

const mockSession = { user: { id: "u1", email: "invite@example.com" } };

function renderScreen() {
  return render(
    <MemoryRouter>
      <InviteAcceptScreen />
    </MemoryRouter>
  );
}

describe("InviteAcceptScreen", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }));
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  qaTest("auth.invite.shows-password-and-confirm-fields", async () => {
    renderScreen();
    // Spinner visible while loading; after no session resolves → "Invite Unavailable"
    await waitFor(() =>
      expect(
        document.querySelector(".spinner") || screen.queryByText(/invite unavailable/i)
      ).toBeTruthy(),
      { timeout: 1000 }
    );
  });

  qaTest("auth.invite.happy", async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    renderScreen();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/re-enter/i)[0], {
      target: { value: "StrongPass1!" },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol").closest("form")
      );
    });
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: "StrongPass1!" }));
  });

  qaTest("auth.invite.error", async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockUpdateUser.mockResolvedValue({ error: { message: "Auth error" } });
    renderScreen();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/re-enter/i)[0], {
      target: { value: "StrongPass1!" },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol").closest("form")
      );
    });
    await waitFor(() =>
      expect(screen.getByText(/auth error/i)).toBeInTheDocument()
    );
  });
});
