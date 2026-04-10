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
export async function setSecurityPolicy(policy) {
  const { data, error } = await supabase.rpc("rpc_admin_set_security_policy", {
    p_policy: policy,
  });
  if (error) throw error;
  return data;
}
