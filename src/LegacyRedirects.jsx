// src/LegacyRedirects.jsx
// ============================================================
// Handles redirects from old query-param based URLs to new
// path-based URLs. Rendered as a catch-all inside the router.
// ============================================================

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Map old ?tab=X (+ optional ?view=Y) to new paths
const TAB_MAP = {
  overview: "/admin/overview",
  jurors: "/admin/jurors",
  projects: "/admin/projects",
  periods: "/admin/periods",
  criteria: "/admin/criteria",
  outcomes: "/admin/outcomes",
  "entry-control": "/admin/entry-control",
  "pin-lock": "/admin/pin-blocking",
  "audit-log": "/admin/audit-log",
  settings: "/admin/settings",
  export: "/admin/settings", // export page removed, redirect to settings
};

const SCORES_VIEW_MAP = {
  rankings: "/admin/rankings",
  analytics: "/admin/analytics",
  grid: "/admin/heatmap",
  details: "/admin/reviews",
};

/**
 * Resolve legacy URL patterns to their new path-based equivalents.
 * Returns the new path (string) or null if no legacy pattern detected.
 */
function resolveLegacyUrl(search, hash, pathname) {
  const params = new URLSearchParams(search);

  // /jury-entry → /jury
  if (pathname === "/jury-entry") return "/jury";

  // ?page=reset-password or ?type=recovery
  if (params.get("page") === "reset-password") return "/reset-password";
  if (params.get("type") === "recovery") return "/reset-password";

  // #type=recovery (Supabase convention)
  if (hash) {
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery") return "/reset-password";
  }

  // ?eval=TOKEN or ?t=TOKEN (without ?explore)
  const evalToken = params.get("eval") || params.get("t");
  if (evalToken && !params.has("explore")) {
    const envParam = params.get("env") === "demo" ? "&env=demo" : "";
    return `/eval?t=${encodeURIComponent(evalToken)}${envParam}`;
  }

  // ?explore&tab=X&view=Y → /demo/admin/X
  if (params.has("explore")) {
    const tab = params.get("tab");
    const view = params.get("view");
    if (tab === "scores" && view && SCORES_VIEW_MAP[view]) {
      return `/demo${SCORES_VIEW_MAP[view]}`;
    }
    if (tab && TAB_MAP[tab]) {
      return `/demo${TAB_MAP[tab]}`;
    }
    return "/demo";
  }

  // ?admin → /login
  if (params.has("admin")) return "/login";

  // ?env=demo&eval=TOKEN → /eval?t=TOKEN&env=demo
  if (params.get("env") === "demo" && evalToken) {
    return `/eval?t=${encodeURIComponent(evalToken)}&env=demo`;
  }

  // ?tab=X&view=Y (prod admin)
  const tab = params.get("tab");
  const view = params.get("view");
  if (tab === "scores" && view && SCORES_VIEW_MAP[view]) {
    return SCORES_VIEW_MAP[view];
  }
  if (tab && TAB_MAP[tab]) {
    return TAB_MAP[tab];
  }

  return null;
}

/**
 * Component that checks for legacy URL patterns on mount
 * and redirects to the new path-based URL.
 * Should be rendered as a route element for the "/" catch-all.
 */
export default function LegacyRedirects({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const newPath = resolveLegacyUrl(
      location.search,
      location.hash,
      location.pathname
    );
    if (newPath) {
      navigate(newPath, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return children || null;
}

export { resolveLegacyUrl };
