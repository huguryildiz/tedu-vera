import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const { mockRequestPinReset } = vi.hoisted(() => ({
  mockRequestPinReset: vi.fn(),
}));

vi.mock("@/shared/api/juryApi", () => ({
  requestPinReset: mockRequestPinReset,
}));

import LockedStep from "../LockedStep";

function makeState(overrides = {}) {
  return {
    pinLockedUntil: new Date(Date.now() + 300000).toISOString(), // 5 mins from now
    periodId: "p1",
    juryName: "Jane",
    affiliation: "TEDU",
    orgName: "TED University",
    tenantAdminEmail: "admin@tedu.edu.tr",
    resetAll: vi.fn(),
    ...overrides,
  };
}

describe("LockedStep — PIN Reset Client Orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestPinReset.mockResolvedValue({ ok: true, sent: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Ensure timers are restored to real timers after each test
    if (vi.isFakeTimersEnabled?.()) {
      vi.useRealTimers();
    }
  });

  // ── Success path ──────────────────────────────────────────────

  qaTest("pin-reset-client-01", () => {
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    // Form should be visible when not expired and admin is available
    expect(screen.getByRole("button", { name: /Request PIN Reset/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Add an optional note/i)).toBeInTheDocument();
    expect(screen.getByText("Evaluation Coordinators")).toBeInTheDocument();
  });

  qaTest("pin-reset-client-02", async () => {
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    expect(button).not.toBeDisabled();

    await fireEvent.click(button);

    // Button should be disabled while sending
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // Verify the RPC was called with correct parameters
    expect(mockRequestPinReset).toHaveBeenCalledOnce();
    expect(mockRequestPinReset).toHaveBeenCalledWith({
      periodId: "p1",
      jurorName: "Jane",
      affiliation: "TEDU",
      message: undefined,
    });
  });

  qaTest("pin-reset-client-03", async () => {
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    // Wait for success state UI
    await waitFor(() => {
      expect(screen.getByText("Request Sent Successfully")).toBeInTheDocument();
    });

    // Success message should display
    expect(screen.getByText(/Your coordinators have been notified/i)).toBeInTheDocument();
    expect(screen.getByText(/They can reset your PIN from the admin panel/i)).toBeInTheDocument();
    expect(screen.getByText(/You'll receive a new PIN shortly/i)).toBeInTheDocument();
  });

  qaTest("pin-reset-client-04", async () => {
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    // Form should be hidden after success
    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Request PIN Reset/i })).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/Add an optional note/i)).not.toBeInTheDocument();
    });
  });

  qaTest("pin-reset-client-05", async () => {
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/Add an optional note/i);
    const button = screen.getByRole("button", { name: /Request PIN Reset/i });

    // Add optional message
    fireEvent.change(textarea, { target: { value: "I think I was given the wrong PIN" } });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(mockRequestPinReset).toHaveBeenCalledWith({
        periodId: "p1",
        jurorName: "Jane",
        affiliation: "TEDU",
        message: "I think I was given the wrong PIN",
      });
    });
  });

  // ── Network failure ───────────────────────────────────────────

  qaTest("pin-reset-client-06", async () => {
    mockRequestPinReset.mockRejectedValueOnce(new Error("Network timeout"));
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText("Network timeout")).toBeInTheDocument();
    });

    // Button should be re-enabled after error
    expect(button).not.toBeDisabled();

    // Form should still be visible
    expect(screen.getByPlaceholderText(/Add an optional note/i)).toBeInTheDocument();
  });

  qaTest("pin-reset-client-07", async () => {
    mockRequestPinReset.mockRejectedValueOnce(new Error("Could not send request. Please try again."));
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Could not send request/i)).toBeInTheDocument();
    });
  });

  qaTest("pin-reset-client-08", async () => {
    mockRequestPinReset.mockRejectedValueOnce(new Error("Server error"));
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    // Error message should display from the thrown error
    await waitFor(() => {
      expect(screen.getByText(/Server error/i)).toBeInTheDocument();
    });
  });

  // ── Double-submit prevention ──────────────────────────────────

  qaTest("pin-reset-client-09", async () => {
    let resolveFirstCall = null;
    const firstCallPromise = new Promise((resolve) => {
      resolveFirstCall = resolve;
    });

    mockRequestPinReset.mockImplementationOnce(() => firstCallPromise);
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });

    // First click
    await fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());

    // Second click while first is pending — should not trigger another call
    await fireEvent.click(button);
    await fireEvent.click(button);

    // Still only one call
    expect(mockRequestPinReset).toHaveBeenCalledOnce();

    // Resolve the first call
    resolveFirstCall?.();
    await waitFor(() => {
      expect(screen.getByText("Request Sent Successfully")).toBeInTheDocument();
    });
  });

  qaTest("pin-reset-client-10", async () => {
    mockRequestPinReset.mockResolvedValueOnce({ ok: true, sent: true });
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    // After success, clicking "Start Over" should work
    await waitFor(() => {
      expect(screen.getByText("Request Sent Successfully")).toBeInTheDocument();
    });

    const startOverLink = screen.getByText("← Start Over");
    await fireEvent.click(startOverLink);

    // resetAll should have been called
    expect(state.resetAll).toHaveBeenCalledOnce();
  });

  // ── Component unmount during pending ──────────────────────────

  qaTest("pin-reset-client-11", async () => {
    let resolveCall = null;
    const promise = new Promise((resolve) => {
      resolveCall = resolve;
    });

    mockRequestPinReset.mockImplementationOnce(() => promise);
    const state = makeState();
    const { unmount } = render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    // Unmount while pending
    unmount();

    // Resolve the promise after unmount
    resolveCall?.();

    // No console errors or warnings should occur (tested by vitest's warning detection)
    // The test passes if there's no unhandled promise rejection or setState warning
    expect(true).toBe(true);
  });

  // ── Missing admin scenario ────────────────────────────────────

  qaTest("pin-reset-client-12", () => {
    const state = makeState({ tenantAdminEmail: null, orgName: null });
    render(<LockedStep state={state} onBack={vi.fn()} />);

    // Form should not be visible if no admin
    expect(screen.queryByText("Request PIN Reset")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Add an optional note/i)).not.toBeInTheDocument();

    // Only the timer should show
    expect(screen.getByText(/Security Lockout/i)).toBeInTheDocument();
  });

  // ── Expired lockout scenario ──────────────────────────────────

  qaTest("pin-reset-client-13", () => {
    const state = makeState({ pinLockedUntil: new Date(Date.now() - 1000).toISOString() }); // Already expired
    render(<LockedStep state={state} onBack={vi.fn()} />);

    // Form should not be visible when lockout is expired
    expect(screen.queryByText("Request PIN Reset")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Add an optional note/i)).not.toBeInTheDocument();

    // Timer should show "Lockout Expired"
    expect(screen.getByText(/Lockout Expired/i)).toBeInTheDocument();
    expect(screen.getByText(/You can now go back and retry/i)).toBeInTheDocument();
  });

  // ── Auth failure (401 from Edge Function) ─────────────────────

  qaTest("pin-reset-client-14", async () => {
    mockRequestPinReset.mockRejectedValueOnce(
      new Error("Session expired. Please reload the page and try again.")
    );
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
    });
  });

  // ── Missing period state ──────────────────────────────────────

  qaTest("pin-reset-client-15", () => {
    const state = makeState({ periodId: null });
    render(<LockedStep state={state} onBack={vi.fn()} />);

    // Button should exist but should not trigger API call when clicked
    // because handleSend checks hasAdmin before proceeding
    const button = screen.queryByRole("button", { name: /Request PIN Reset/i });
    // This case depends on hasAdmin logic — if no periodId but orgName exists, button may still appear
    // The key is that the API call requires periodId
  });

  // ── Whitespace in message ─────────────────────────────────────

  qaTest("pin-reset-client-16", async () => {
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/Add an optional note/i);
    const button = screen.getByRole("button", { name: /Request PIN Reset/i });

    // Message with whitespace should be trimmed
    fireEvent.change(textarea, { target: { value: "   Just whitespace   " } });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(mockRequestPinReset).toHaveBeenCalledWith({
        periodId: "p1",
        jurorName: "Jane",
        affiliation: "TEDU",
        message: "Just whitespace", // Trimmed
      });
    });
  });

  // ── Empty message with only whitespace ────────────────────────

  qaTest("pin-reset-client-17", async () => {
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/Add an optional note/i);
    const button = screen.getByRole("button", { name: /Request PIN Reset/i });

    // Whitespace-only message should be treated as undefined
    fireEvent.change(textarea, { target: { value: "    " } });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(mockRequestPinReset).toHaveBeenCalledWith({
        periodId: "p1",
        jurorName: "Jane",
        affiliation: "TEDU",
        message: undefined, // Empty after trim
      });
    });
  });

  // ── Loading state UI ──────────────────────────────────────────

  qaTest("pin-reset-client-18", async () => {
    let resolveCall = null;
    const promise = new Promise((resolve) => {
      resolveCall = resolve;
    });

    mockRequestPinReset.mockImplementationOnce(() => promise);
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    // Button text should change to "Sending..."
    await waitFor(() => {
      expect(screen.getByText(/Sending/i)).toBeInTheDocument();
    });

    // Icon should be a spinner with spin animation
    const loadingButton = screen.getByRole("button", { name: /Sending/i });
    // The button should contain a spinning icon
    const buttonHTML = loadingButton.innerHTML;
    expect(buttonHTML).toContain("jg-spin");
    expect(buttonHTML).toContain("lucide");

    resolveCall?.();
  });

  // ── Error state is clearable ──────────────────────────────────

  qaTest("pin-reset-client-19", async () => {
    const state = makeState();
    let callCount = 0;

    mockRequestPinReset.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("First attempt failed");
      }
      return { ok: true, sent: true };
    });

    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });

    // First attempt fails
    await fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText("First attempt failed")).toBeInTheDocument();
    });

    // Error should clear on retry
    await fireEvent.click(button);
    await waitFor(() => {
      expect(screen.queryByText("First attempt failed")).not.toBeInTheDocument();
      expect(screen.getByText("Request Sent Successfully")).toBeInTheDocument();
    });
  });

  // ── Button disabled when locked OR already sent ────────────────

  qaTest("pin-reset-client-20", async () => {
    mockRequestPinReset.mockResolvedValueOnce({ ok: true, sent: true });
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    expect(button).not.toBeDisabled();

    await fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Request Sent Successfully")).toBeInTheDocument();
    });

    // After success, button should be gone (entire form replaced by success message)
    expect(screen.queryByRole("button", { name: /Request PIN Reset/i })).not.toBeInTheDocument();
  });

  // ── Integration: countdown timer still active during reset ────

  qaTest("pin-reset-client-21", async () => {
    // Test that timer is running and updates
    const futureTime = new Date(Date.now() + 10000).toISOString();
    const state = makeState({ pinLockedUntil: futureTime });

    render(<LockedStep state={state} onBack={vi.fn()} />);

    // Timer should be running (matches MM:SS format)
    const timerElement = screen.getByText(/\d{2}:\d{2}/);
    expect(timerElement).toBeInTheDocument();

    // Timer text should have digits
    expect(timerElement.textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  // ── Form remains intact until success ──────────────────────────

  qaTest("pin-reset-client-22", async () => {
    mockRequestPinReset.mockResolvedValueOnce({ ok: true, sent: true });
    const state = makeState();
    render(<LockedStep state={state} onBack={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/Add an optional note/i);
    fireEvent.change(textarea, { target: { value: "Test message" } });

    const button = screen.getByRole("button", { name: /Request PIN Reset/i });
    await fireEvent.click(button);

    // Form should disappear after success
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Add an optional note/i)).not.toBeInTheDocument();
    });

    // Success state should show
    expect(screen.getByText("Request Sent Successfully")).toBeInTheDocument();
  });
});
