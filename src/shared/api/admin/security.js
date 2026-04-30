// src/shared/api/admin/security.js
// Security policy API — get and set platform-wide security settings.
// Most functions are super admin only; getPublicAuthFlags() is anon-callable
// and returns only the three public authentication toggles for the login UI.

import { supabase } from "../core/client";

/**
 * Anonymous/authenticated — read only the public authentication flags
 * needed to render the login screen (hide disabled auth methods).
 * Calls rpc_public_auth_flags which is granted to anon + authenticated.
 * @returns {Promise<{
 *   googleOAuth: boolean,
 *   emailPassword: boolean,
 *   rememberMe: boolean
 * }>}
 */
export async function getPublicAuthFlags() {
  const { data, error } = await supabase.rpc("rpc_public_auth_flags");
  if (error) throw error;
  return data;
}

/**
 * Super admin — read the current security policy for the admin drawer.
 * @returns {Promise<{
 *   googleOAuth: boolean,
 *   emailPassword: boolean,
 *   rememberMe: boolean,
 *   qrTtl: string,
 *   maxPinAttempts: number,
 *   pinLockCooldown: string,
 *   ccOnPinReset: boolean,
 *   ccOnScoreEdit: boolean,
 *   ccOnTenantApplication: boolean,
 *   ccOnMaintenance: boolean,
 *   ccOnPasswordChanged: boolean,
 *   updated_at: string|null
 * }>}
 */
export async function getSecurityPolicy() {
  const { data, error } = await supabase.rpc("rpc_admin_get_security_policy");
  if (error) throw error;
  return data;
}

/**
 * Super admin — persist the security policy.
 * @param {{
 *   googleOAuth: boolean,
 *   emailPassword: boolean,
 *   rememberMe: boolean,
 *   qrTtl: string,
 *   maxPinAttempts: number,
 *   pinLockCooldown: string,
 *   ccOnPinReset: boolean,
 *   ccOnScoreEdit: boolean,
 *   ccOnTenantApplication: boolean,
 *   ccOnMaintenance: boolean,
 *   ccOnPasswordChanged: boolean
 * }} policy
 */
const POLICY_KEYS = [
  "googleOAuth", "emailPassword", "rememberMe", "qrTtl",
  "maxPinAttempts", "pinLockCooldown",
  "ccOnPinReset", "ccOnScoreEdit", "ccOnTenantApplication",
  "ccOnMaintenance", "ccOnPasswordChanged",
];

export async function setSecurityPolicy(policy) {
  const payload = Object.fromEntries(
    POLICY_KEYS.filter((k) => k in policy).map((k) => [k, policy[k]])
  );
  const { data, error } = await supabase.rpc("rpc_admin_set_security_policy", {
    p_policy: payload,
  });
  if (error) throw error;
  return data;
}

/**
 * Tenant admin + super admin — read PIN lockout policy fields.
 * @returns {Promise<{ maxPinAttempts: number, pinLockCooldown: string }>}
 */
export async function getPinPolicy() {
  const { data, error } = await supabase.rpc("rpc_admin_get_pin_policy");
  if (error) throw error;
  return data;
}

/**
 * Tenant admin + super admin — update PIN lockout policy fields only.
 * @param {{ maxPinAttempts: number, pinLockCooldown: string, qrTtl: string }} policy
 */
export async function setPinPolicy({ maxPinAttempts, pinLockCooldown, qrTtl }) {
  const { data, error } = await supabase.rpc("rpc_admin_set_pin_policy", {
    p_max_attempts: maxPinAttempts,
    p_cooldown: pinLockCooldown,
    p_qr_ttl: qrTtl,
  });
  if (error) throw error;
  return data;
}
