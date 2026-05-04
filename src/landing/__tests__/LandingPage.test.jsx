import { describe, vi, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

// jsdom has no IntersectionObserver — polyfill for editorial-reveal observer
beforeAll(() => {
  global.IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

const { DEMO_CLIENT } = vi.hoisted(() => {
  const DEMO_CLIENT = {
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return { DEMO_CLIENT };
});

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {},
  getDemoClient: () => DEMO_CLIENT,
}));

vi.mock("@/shared/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "dark", setTheme: () => {} }),
}));

import { LandingPage } from "../LandingPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe("LandingPage", () => {
  qaTest("coverage.landing.hero-displays-headline-text", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/Evaluate/i);
    expect(h1).toHaveTextContent(/Prove/i);
  });

  qaTest("coverage.landing.hero-renders-dual-cta", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Be a juror/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tour the admin panel/i })).toBeInTheDocument();
  });

  qaTest("coverage.landing.live-signal-renders-four-stats", () => {
    renderPage();
    expect(screen.getByLabelText(/live signal/i)).toBeInTheDocument();
    expect(screen.getByText(/Active jurors/i)).toBeInTheDocument();
    expect(screen.getByText(/Evaluations/i)).toBeInTheDocument();
    expect(screen.getByText(/Organizations/i)).toBeInTheDocument();
    expect(screen.getByText(/Projects · scored/i)).toBeInTheDocument();
  });
});
