// src/admin/components/UserAvatarMenu.jsx
// ============================================================
// Avatar button + minimal session/profile dropdown.
// Compact header · Settings · Organizations (super) · Sign Out
// ============================================================

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/auth";
import { useFloating } from "@/shared/hooks/useFloating";
import { SettingsIcon, BuildingIcon, LogOutIcon } from "@/shared/ui/Icons";
import Avatar from "@/shared/ui/Avatar";

// ── Helpers ──────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];

function getInitials(displayName, email) {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

function getAvatarColor(name) {
  const code = (name || "?").charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ── Main Component ───────────────────────────────────────────

export default function UserAvatarMenu({ onLogout, onNavigate }) {
  const { user, displayName, avatarUrl, activeOrganization, isSuper } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);

  const { floatingRef, floatingStyle } = useFloating({
    triggerRef,
    isOpen: menuOpen,
    onClose: () => setMenuOpen(false),
    placement: 'bottom-end',
    offset: 6,
    closeOnScroll: false,
  });

  const initials = getInitials(displayName, user?.email);
  const avatarBg = getAvatarColor(displayName || user?.email);

  const handleAction = useCallback((action) => {
    setMenuOpen(false);
    if (action === "settings" || action === "organizations") onNavigate?.("settings");
    else if (action === "logout") onLogout?.();
  }, [onNavigate, onLogout]);

  return (
    <>
      <button
        ref={triggerRef}
        className="ph-avatar-btn"
        style={{ background: "transparent", padding: 0, overflow: "hidden" }}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={menuOpen}
        title={displayName || user?.email || "Account"}
      >
        <Avatar avatarUrl={avatarUrl} initials={initials} bg={avatarBg} size={34} style={{ borderRadius: "50%", pointerEvents: "none" }} />
      </button>

      {menuOpen && createPortal(
        <div
          ref={floatingRef}
          className="ph-avatar-menu"
          style={floatingStyle}
          role="menu"
          aria-label="Account menu"
        >
          {/* Compact header */}
          <div className="ph-avatar-menu-header">
            <Avatar avatarUrl={avatarUrl} initials={initials} bg={avatarBg} size={36} style={{ borderRadius: "50%", flexShrink: 0 }} />
            <div className="ph-avatar-menu-identity">
              <span className="ph-avatar-menu-name">{displayName || "Admin"}</span>
              <span className={`ph-avatar-role-badge${isSuper ? " ph-avatar-role-badge--super" : ""}`}>
                {isSuper ? "Super Admin" : "Admin"}
              </span>
              {!isSuper && activeOrganization && (
                <span className="ph-avatar-menu-tenant">{activeOrganization.name}</span>
              )}
            </div>
          </div>

          <div className="ph-avatar-menu-divider" />

          <button className="ph-avatar-menu-item" role="menuitem" onClick={() => handleAction("settings")}>
            <SettingsIcon /> Settings
          </button>

          {isSuper && (
            <button className="ph-avatar-menu-item" role="menuitem" onClick={() => handleAction("organizations")}>
              <BuildingIcon /> Organizations
            </button>
          )}

          <div className="ph-avatar-menu-divider" />

          <button className="ph-avatar-menu-item ph-avatar-menu-item--danger" role="menuitem" onClick={() => handleAction("logout")}>
            <LogOutIcon /> Sign Out
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
