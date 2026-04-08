// src/shared/lib/environment.js
// Runtime environment store.
// Determines whether the app talks to the production or demo Supabase instance.
//
// Resolution order:
//   1. URL pathname starts with /demo — implicit via React Router
//   2. URL param ?env=demo — explicit at entry (QR codes)
//   3. sessionStorage['vera_env'] — persisted within current browser tab/session
//   4. Default → 'prod'

const ENV_KEY = "vera_env";
const JURY_ACCESS_KEY = "jury_access_period";

// Auto-clear stale demo environment at module load.
// Preserve it when: (a) URL indicates demo mode, or (b) an active jury
// session exists (jury_access_period in sessionStorage — survives refresh).
if (typeof window !== "undefined") {
  const _p = new URLSearchParams(window.location.search);
  const isDemo =
    window.location.pathname.startsWith("/demo") ||
    _p.get("env") === "demo";
  const hasActiveJury = !!sessionStorage.getItem(JURY_ACCESS_KEY);
  if (!isDemo && !hasActiveJury) {
    sessionStorage.removeItem(ENV_KEY);
  }
}

/**
 * Resolve the active environment ('prod' | 'demo').
 * Called on every Supabase client access via the Proxy in supabaseClient.js,
 * so it must be fast and side-effect-free.
 */
export function resolveEnvironment() {
  if (typeof window === "undefined") return "prod";
  // Pathname-based detection (React Router)
  if (window.location.pathname.startsWith("/demo")) return "demo";
  // Query param detection (for /eval?t=TOKEN&env=demo)
  const params = new URLSearchParams(window.location.search);
  if (params.get("env") === "demo") return "demo";
  // Session storage (set by DemoLayout or setEnvironment)
  const stored = sessionStorage.getItem(ENV_KEY);
  if (stored === "demo") return stored;
  return "prod";
}

/** Persist environment selection for the current browser session. */
export function setEnvironment(env) {
  sessionStorage.setItem(ENV_KEY, env);
}

/** Clear persisted environment (reverts to default 'prod' on next resolve). */
export function clearEnvironment() {
  sessionStorage.removeItem(ENV_KEY);
}

/** Convenience: true when the active environment is 'demo'. */
export function isDemoEnvironment() {
  return resolveEnvironment() === "demo";
}
