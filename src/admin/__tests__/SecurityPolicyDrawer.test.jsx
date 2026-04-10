// src/admin/__tests__/SecurityPolicyDrawer.test.jsx
// Tests for the rewritten Security Policy drawer.
// Covers the new three-section layout, the rename from tokenTtl/maxLoginAttempts
// to qrTtl/maxPinAttempts, the master-of-children notifications toggle, the
// at-least-one-auth-method safeguard, and the absence of the old Password
// Requirements section.

import { describe, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { qaTest } from "../../test/qaTest.js";
import SecurityPolicyDrawer from "../drawers/SecurityPolicyDrawer.jsx";

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

function renderDrawer(overrides = {}) {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(),
    error: null,
    policy: {
      googleOAuth: true,
      emailPassword: true,
      rememberMe: true,
      qrTtl: "24h",
      maxPinAttempts: 5,
      pinLockCooldown: "30m",
      ccOnPinReset: true,
      ccOnScoreEdit: true,
      ccOnTenantApplication: true,
      ccOnMaintenance: true,
      ccOnPasswordChanged: true,
    },
  };
  return render(<SecurityPolicyDrawer {...defaultProps} {...overrides} />);
}

describe("SecurityPolicyDrawer", () => {
  qaTest("security_policy.drawer.schema", async () => {
    const onSave = vi.fn().mockResolvedValue();
    renderDrawer({ onSave });
    fireEvent.click(screen.getByRole("button", { name: /save policy/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({
      googleOAuth: true,
      emailPassword: true,
      rememberMe: true,
      qrTtl: "24h",
      maxPinAttempts: 5,
      pinLockCooldown: "30m",
      ccOnPinReset: true,
      ccOnScoreEdit: true,
      ccOnTenantApplication: true,
      ccOnMaintenance: true,
      ccOnPasswordChanged: true,
    });
    expect(saved).not.toHaveProperty("minPasswordLength");
    expect(saved).not.toHaveProperty("maxLoginAttempts");
    expect(saved).not.toHaveProperty("requireSpecialChars");
    expect(saved).not.toHaveProperty("tokenTtl");
    expect(saved).not.toHaveProperty("allowMultiDevice");
  });

  qaTest("security_policy.drawer.auth_safeguard", async () => {
    const onSave = vi.fn().mockResolvedValue();
    renderDrawer({
      onSave,
      policy: {
        googleOAuth: false,
        emailPassword: false,
        rememberMe: true,
        qrTtl: "24h",
        maxPinAttempts: 5,
        pinLockCooldown: "30m",
        ccOnPinReset: true,
        ccOnScoreEdit: true,
        ccOnTenantApplication: true,
        ccOnMaintenance: true,
        ccOnPasswordChanged: true,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save policy/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/at least one authentication method must remain enabled/i),
      ).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  qaTest("security_policy.drawer.master_toggle_on", async () => {
    const onSave = vi.fn().mockResolvedValue();
    renderDrawer({
      onSave,
      policy: {
        googleOAuth: true,
        emailPassword: true,
        rememberMe: true,
        qrTtl: "24h",
        maxPinAttempts: 5,
        pinLockCooldown: "30m",
        ccOnPinReset: false,
        ccOnScoreEdit: false,
        ccOnTenantApplication: false,
        ccOnMaintenance: false,
        ccOnPasswordChanged: false,
      },
    });
    // Master toggle is the one whose label contains "CC Super Admin on All Notifications".
    const masterLabel = screen.getByText(/cc super admin on all notifications/i);
    // Find the closest containing div and then find the label inside it
    let masterToggle = null;
    let current = masterLabel;
    while (current && !masterToggle) {
      masterToggle = current.querySelector("label");
      current = current.parentElement;
    }
    if (!masterToggle) throw new Error("Could not find master toggle element");
    fireEvent.click(masterToggle);
    fireEvent.click(screen.getByRole("button", { name: /save policy/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved.ccOnPinReset).toBe(true);
    expect(saved.ccOnScoreEdit).toBe(true);
    expect(saved.ccOnTenantApplication).toBe(true);
    expect(saved.ccOnMaintenance).toBe(true);
    expect(saved.ccOnPasswordChanged).toBe(true);
  });

  qaTest("security_policy.drawer.master_toggle_off", async () => {
    const onSave = vi.fn().mockResolvedValue();
    renderDrawer({ onSave });
    // Default policy has all five children on → master reads as on.
    const masterLabel = screen.getByText(/cc super admin on all notifications/i);
    // Find the closest containing div and then find the label inside it
    let masterToggle = null;
    let current = masterLabel;
    while (current && !masterToggle) {
      masterToggle = current.querySelector("label");
      current = current.parentElement;
    }
    if (!masterToggle) throw new Error("Could not find master toggle element");

    // Debug: verify we have the right toggle
    const thumbDiv = masterToggle.querySelector("div:last-child");
    expect(thumbDiv?.style.transform).toMatch(/translateX\(16px\)/);

    // Click the toggle - this should turn all five child toggles to false
    fireEvent.click(masterToggle);

    // After clicking, we should see state change
    await waitFor(() => {
      // Check that the toggle's thumb has moved
      const updatedThumbDiv = masterToggle.querySelector("div:last-child");
      expect(updatedThumbDiv?.style.transform).not.toMatch(/translateX\(16px\)/);
    });

    fireEvent.click(screen.getByRole("button", { name: /save policy/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved.ccOnPinReset).toBe(false);
    expect(saved.ccOnScoreEdit).toBe(false);
    expect(saved.ccOnTenantApplication).toBe(false);
    expect(saved.ccOnMaintenance).toBe(false);
    expect(saved.ccOnPasswordChanged).toBe(false);
  });

  qaTest("security_policy.drawer.no_password_section", async () => {
    renderDrawer();
    expect(screen.queryByText(/password requirements/i)).toBeNull();
    expect(screen.queryByText(/minimum length/i)).toBeNull();
    expect(screen.queryByText(/max login attempts/i)).toBeNull();
  });

  qaTest("security_policy.drawer.new_labels", async () => {
    renderDrawer();
    expect(screen.getByText(/qr code ttl/i)).toBeInTheDocument();
    expect(screen.getByText(/max pin attempts/i)).toBeInTheDocument();
    expect(screen.queryByText(/entry token ttl/i)).toBeNull();
  });
});
