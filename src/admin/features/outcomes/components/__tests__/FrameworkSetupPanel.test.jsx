import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

import FrameworkSetupPanel from "../FrameworkSetupPanel";

describe("FrameworkSetupPanel", () => {
  qaTest("coverage.framework-setup-panel.no-periods", () => {
    const { container } = render(
      <MemoryRouter>
        <FrameworkSetupPanel
          variant="noPeriods"
          showFwPicker={false}
          setShowFwPicker={vi.fn()}
          periodsWithFrameworks={[]}
          effectivePlatformFrameworks={[]}
          frameworks={[]}
          pendingImport={null}
          onStartBlank={vi.fn()}
          onCloneFromPeriod={vi.fn()}
          onCloneTemplate={vi.fn()}
          onAddDrawerOpen={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeTruthy();
  });
});
