import { describe, vi, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("qr-code-styling", () => ({
  default: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    append: vi.fn(),
    getRawData: vi.fn().mockResolvedValue(new Blob()),
  })),
}));

vi.mock("@/assets/vera_logo.png", () => ({ default: "mock-logo.png" }));

const mockGetStatus = vi.fn().mockResolvedValue({ has_token: false, enabled: false });

vi.mock("@/shared/api", () => ({
  generateEntryToken: vi.fn(),
  publishPeriod: vi.fn(),
  revokeEntryToken: vi.fn(),
  getEntryTokenStatus: (...args) => mockGetStatus(...args),
}));

vi.mock("@/shared/lib/environment", () => ({
  isDemoEnvironment: () => false,
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/admin/shared/JuryRevokeConfirmDialog", () => ({
  default: () => null,
}));

vi.mock("@/shared/ui/Icons", () => ({
  QrCodeIcon: () => <span data-testid="qr-icon" />,
  RefreshCcwIcon: () => <span />,
  BanIcon: () => <span />,
  CheckCircle2Icon: () => <span />,
  CopyIcon: () => <span />,
  EyeIcon: () => <span />,
  EyeOffIcon: () => <span />,
  ChevronDownIcon: () => <span />,
  AlertCircleIcon: () => <span />,
}));

vi.mock("@/shared/storage", () => ({
  getRawToken: () => null,
  setRawToken: vi.fn(),
  clearRawToken: vi.fn(),
}));

vi.mock("@/shared/lib/dateUtils", () => ({
  formatDateTime: () => "Jan 1, 2024",
}));

import JuryEntryControlPanel from "../JuryEntryControlPanel";

describe("JuryEntryControlPanel", () => {
  qaTest("coverage.jury-entry-control.no-period-prompt", () => {
    render(
      <JuryEntryControlPanel
        periodId={undefined}
        periodName=""
        isOpen={true}
        onToggle={vi.fn()}
        isMobile={false}
      />
    );
    expect(
      screen.getByText("Select a period to manage its jury access token.")
    ).toBeInTheDocument();
  });

  qaTest("coverage.jury-entry-control.shows-generate-button", async () => {
    mockGetStatus.mockResolvedValueOnce({ has_token: false, enabled: false });
    render(
      <JuryEntryControlPanel
        periodId="p1"
        periodName="Spring 2024"
        isOpen={true}
        onToggle={vi.fn()}
        isMobile={false}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Generate QR")).toBeInTheDocument();
    });
  });
});
