import { describe, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { MemoryRouter } from "react-router-dom";

import DraggableThemeToggle from "../DraggableThemeToggle";

describe("DraggableThemeToggle", () => {
  qaTest("coverage.draggable-theme-toggle.renders", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/jury/evaluate"]}>
        <ThemeProvider>
          <DraggableThemeToggle />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(container.firstChild).toBeTruthy();
  });
});
