import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

import DemoLayout from "../DemoLayout";
import AuthRouteLayout from "../AuthRouteLayout";

describe("DemoLayout", () => {
  qaTest("coverage.demo-layout.renders-outlet", () => {
    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <Routes>
          <Route path="/demo" element={<DemoLayout />}>
            <Route index element={<span>demo-child</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("demo-child")).toBeInTheDocument();
  });
});

describe("AuthRouteLayout", () => {
  qaTest("coverage.auth-route-layout.renders-outlet", () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AuthRouteLayout />}>
            <Route index element={<span>auth-child</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("auth-child")).toBeInTheDocument();
  });
});
