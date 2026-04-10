// src/admin/__tests__/SecuritySignalPill.test.jsx
import { describe, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { qaTest } from "../../test/qaTest.js";
import SecuritySignalPill from "../components/SecuritySignalPill.jsx";

vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));

function makeSignal(overrides = {}) {
  return {
    state: "secure",
    signals: {
      sessionCount: { value: 1, severity: "ok" },
      countryDiversity: { value: 1, severity: "ok" },
      lastLoginFreshness: { value: 2, severity: "ok" },
      expiredSessions: { value: 0, severity: "ok" },
    },
    verdict: { title: null, reason: null },
    ...overrides,
  };
}

describe("SecuritySignalPill", () => {
  qaTest("settings.security.pill.01", () => {
    const signal = makeSignal({
      state: "review",
      verdict: {
        title: "This account needs a review.",
        reason: "4 active sessions pushed this account to Review.",
      },
      signals: {
        sessionCount: { value: 4, severity: "warn" },
        countryDiversity: { value: 1, severity: "ok" },
        lastLoginFreshness: { value: 2, severity: "ok" },
        expiredSessions: { value: 0, severity: "ok" },
      },
    });
    render(<SecuritySignalPill signal={signal} onReviewSessions={() => {}} />);

    // Popover is closed initially
    expect(screen.queryByRole("dialog")).toBeNull();

    // Click opens the popover
    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("This account needs a review.")).toBeInTheDocument();

    // Click again closes it
    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  qaTest("settings.security.pill.02", () => {
    const signal = makeSignal({ state: "review", verdict: { title: "Needs review.", reason: "Reason." } });
    render(<SecuritySignalPill signal={signal} onReviewSessions={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  qaTest("settings.security.pill.03", () => {
    const onReview = vi.fn();
    const signal = makeSignal({ state: "risk", verdict: { title: "At risk.", reason: "Reason." } });
    render(<SecuritySignalPill signal={signal} onReviewSessions={onReview} />);

    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    const footerBtn = screen.getByRole("button", { name: /review sessions/i });
    fireEvent.click(footerBtn);
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  qaTest("settings.security.pill.04", () => {
    // Secure state: no verdict banner, but popover still opens with All clear header
    const signal = makeSignal();
    render(<SecuritySignalPill signal={signal} onReviewSessions={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/all security signals are clear/i)).toBeInTheDocument();
    // No verdict title rendered for secure state
    expect(screen.queryByText(/needs a review/i)).toBeNull();
    expect(screen.queryByText(/is at risk/i)).toBeNull();
  });

  qaTest("settings.security.pill.05", () => {
    // Review state renders the amber banner title
    const signal = makeSignal({
      state: "review",
      verdict: {
        title: "This account needs a review.",
        reason: "4 active sessions pushed this account to Review.",
      },
      signals: {
        sessionCount: { value: 4, severity: "warn" },
        countryDiversity: { value: 1, severity: "ok" },
        lastLoginFreshness: { value: 2, severity: "ok" },
        expiredSessions: { value: 0, severity: "ok" },
      },
    });
    render(<SecuritySignalPill signal={signal} onReviewSessions={() => {}} />);
    expect(screen.getByRole("button", { name: /security signal: review/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.getByText("This account needs a review.")).toBeInTheDocument();
    expect(
      screen.getByText("4 active sessions pushed this account to Review."),
    ).toBeInTheDocument();
  });
});
