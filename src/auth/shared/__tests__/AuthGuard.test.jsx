import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/auth", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/auth";
import AuthGuard from "../AuthGuard";

describe("AuthGuard", () => {
  qaTest("auth.guard.01", () => {
    useAuth.mockReturnValue({ user: { id: "u1", email: "a@b.com" }, loading: false });
    render(
      <MemoryRouter initialEntries={["/admin/overview"]}>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/admin/overview" element={<div>Protected content</div>} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  qaTest("auth.guard.02", () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/admin/overview"]}>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/admin/overview" element={<div>Protected content</div>} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  qaTest("auth.guard.03", () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/demo/admin/overview"]}>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/demo/admin/overview" element={<div>Protected content</div>} />
          </Route>
          <Route path="/demo" element={<div>Demo page</div>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Demo page")).toBeInTheDocument();
  });
});
