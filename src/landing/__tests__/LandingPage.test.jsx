import { describe, vi, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

// jsdom has no IntersectionObserver — polyfill for useCountUp and scroll reveals
beforeAll(() => {
  global.IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// ── Stable constants ─────────────────────────────────────────────────────────

const { DEMO_CLIENT } = vi.hoisted(() => {
  const DEMO_CLIENT = {
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return { DEMO_CLIENT };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {},
  getDemoClient: () => DEMO_CLIENT,
}));

vi.mock("@/shared/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", setTheme: () => {} }),
}));

vi.mock("../components/ProductShowcase", () => ({ default: () => null }));

vi.mock("@/assets/vera_logo_dark.png", () => ({ default: "vera_logo_dark.png" }));
vi.mock("@/assets/vera_logo_white.png", () => ({ default: "vera_logo_white.png" }));
vi.mock("@/assets/favicon/web-app-manifest-512x512.png", () => ({ default: "nav-dark.png" }));
vi.mock("@/assets/favicon/favicon_light.png", () => ({ default: "nav-light.png" }));

import { LandingPage } from "../LandingPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe("LandingPage", () => {
  qaTest("coverage.landing.hero-renders", () => {
    renderPage();
    expect(screen.getByText(/Evaluate anything/i)).toBeInTheDocument();
  });

});
