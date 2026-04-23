import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <span>{children}</span>,
}));
vi.mock("@/shared/hooks/useShakeOnError", () => ({
  default: () => ({ current: null }),
}));
vi.mock("@/shared/lib/dateUtils", () => ({ formatRelative: () => "2 days ago" }));

import EditJurorDrawer from "../EditJurorDrawer";

const JUROR = {
  id: "juror-001",
  name: "Prof. Dr. Ali Demir",
  affiliation: "Bilkent University",
  email: "demir@bilkent.edu.tr",
  progress: { scored: 2, total: 5 },
};

describe("EditJurorDrawer", () => {
  qaTest("admin.jurors.edit.render", () => {
    render(
      <EditJurorDrawer
        open
        onClose={vi.fn()}
        juror={JUROR}
        onSave={vi.fn()}
        onResetPin={vi.fn()}
        onRemove={vi.fn()}
        error={null}
      />
    );

    expect(screen.getByDisplayValue("Prof. Dr. Ali Demir")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bilkent University")).toBeInTheDocument();
    expect(screen.getByDisplayValue("demir@bilkent.edu.tr")).toBeInTheDocument();
  });
});
