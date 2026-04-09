// src/admin/hooks/useAdminNav.js
// ============================================================
// Replaces useAdminTabs.js for React Router v6 migration.
// Uses useLocation() + useNavigate() instead of query params
// and pushState for admin panel navigation.
// ============================================================

import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useRef } from "react";

// Tabs that have editable forms — dirty guard applies
const DIRTY_PAGES = new Set([
  "settings", "jurors", "projects", "periods", "criteria", "outcomes", "organizations",
]);

// Map pathname segment to page key
function getPageKey(pathname) {
  // /admin/rankings → "rankings"
  // /demo/admin/rankings → "rankings"
  const segments = pathname.split("/").filter(Boolean);
  // Find "admin" segment and take what comes after
  const adminIdx = segments.indexOf("admin");
  if (adminIdx >= 0 && adminIdx < segments.length - 1) {
    return segments[adminIdx + 1];
  }
  return "overview";
}

// Derive base path (handles /admin vs /demo/admin)
function getBasePath(pathname) {
  if (pathname.startsWith("/demo/admin")) return "/demo/admin";
  return "/admin";
}

/**
 * useAdminNav — React Router based admin navigation.
 *
 * @param {object} opts
 * @param {React.MutableRefObject<boolean>} opts.settingsDirtyRef
 *
 * @returns {{
 *   currentPage: string,
 *   basePath: string,
 *   navigateTo: (page: string) => void,
 *   isDemo: boolean,
 * }}
 */
export function useAdminNav({ settingsDirtyRef } = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage = getPageKey(location.pathname);
  const basePath = getBasePath(location.pathname);
  const isDemo = basePath.startsWith("/demo");

  const navigateTo = useCallback((page) => {
    // Guard against leaving dirty pages
    if (DIRTY_PAGES.has(currentPage) && settingsDirtyRef?.current) {
      if (!window.confirm("You have unsaved changes. Leave anyway?")) return;
    }
    navigate(`${basePath}/${page}`);
  }, [currentPage, settingsDirtyRef, basePath, navigate]);

  return {
    currentPage,
    basePath,
    navigateTo,
    isDemo,
  };
}

/**
 * Derive the label for the current admin page from pathname.
 * Used by AdminHeader for breadcrumb display.
 */
const PAGE_LABELS = {
  overview: "Overview",
  rankings: "Rankings",
  analytics: "Analytics",
  heatmap: "Heatmap",
  reviews: "Reviews",
  jurors: "Jurors",
  projects: "Projects",
  periods: "Evaluation Periods",
  criteria: "Evaluation Criteria",
  outcomes: "Outcomes & Mapping",
  "entry-control": "Entry Control",
  "pin-blocking": "PIN Blocking",
  "audit-log": "Audit Log",
  organizations: "Organizations",
  settings: "Settings",
};

export function getPageLabel(pathname) {
  const key = getPageKey(pathname);
  return PAGE_LABELS[key] || "Overview";
}
