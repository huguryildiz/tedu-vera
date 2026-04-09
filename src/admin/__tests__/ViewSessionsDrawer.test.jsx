import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ViewSessionsDrawer from "../drawers/ViewSessionsDrawer";

describe("ViewSessionsDrawer", () => {
  it("marks current session, uses signed-in fallback, and renders Unknown country", () => {
    const { container } = render(
      <ViewSessionsDrawer
        open
        onClose={() => {}}
        currentDeviceId="dev_current"
        sessions={[
          {
            id: "older",
            device_id: "dev_old",
            browser: "Firefox",
            os: "Linux",
            ip_address: "bad-ip",
            country_code: null,
            signed_in_at: null,
            first_seen_at: "2026-04-09T08:00:00.000Z",
            last_activity_at: "2026-04-09T09:00:00.000Z",
            auth_method: "Email",
            expires_at: null,
          },
          {
            id: "newer",
            device_id: "dev_current",
            browser: "Chrome",
            os: "macOS",
            ip_address: "203.0.113.24",
            country_code: "TR",
            signed_in_at: "2026-04-10T08:00:00.000Z",
            first_seen_at: "2026-04-10T08:00:00.000Z",
            last_activity_at: "2026-04-10T09:00:00.000Z",
            auth_method: "Google",
            expires_at: "2026-04-10T12:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Current Session")).toBeInTheDocument();
    expect(screen.getByLabelText("signed-in-fallback-info")).toBeInTheDocument();
    expect(screen.getByText("(first seen)")).toBeInTheDocument();
    expect(screen.getAllByText(/Country:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);

    const cardNames = Array.from(container.querySelectorAll(".fs-session-card-name")).map((node) => node.textContent);
    expect(cardNames[0]).toContain("Chrome / macOS");
    expect(cardNames[1]).toContain("Firefox / Linux");
  });
});
