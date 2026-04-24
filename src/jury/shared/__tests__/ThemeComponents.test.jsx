import { describe, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";

import ThemeToggleIcon from "../ThemeToggleIcon";

describe("ThemeToggleIcon", () => {
  qaTest("coverage.theme-toggle-icon.renders", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggleIcon size={18} />
      </ThemeProvider>
    );
    expect(container.firstChild).toBeTruthy();
  });
});
